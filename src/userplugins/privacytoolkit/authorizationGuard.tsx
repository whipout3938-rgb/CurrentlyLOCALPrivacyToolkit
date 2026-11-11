/*
 * PrivacyToolkit App Authorization Guard
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Warns before standard Discord OAuth2 authorization links are opened.
 * This cannot verify what an app does with data after authorization.
 */
import { ConfirmModal, openModal } from "@webpack/common";

type AuthorizationGuardSettings = {
    store: {
        appAuthorizationGuardEnabled: boolean;
        warnOnEmailScope: boolean;
        warnOnSensitiveScopes: boolean;
        warnOnPrivilegedBotPermissions: boolean;
        warnOnBotMessageAccess: boolean;
    };
};

type AuthorizationRisk = {
    title: string;
    detail: string;
};

const SCOPE_DETAILS: Record<string, string> = {
    identify: "Basic Discord account identity (such as account ID, username, and avatar)",
    email: "The email address associated with your Discord account",
    connections: "Connected accounts and linked-service information",
    guilds: "Information about the Discord servers you are in",
    "guilds.members.read": "Information about your membership in servers",
    "guilds.join": "Permission for the application to add your account to a server",
    "role_connections.write": "Permission to update linked-role connection metadata",
    "dm_channels.read": "Access to direct-message channel information where Discord permits it",
    "messages.read": "Message-related access supported by the requested integration",
    bot: "Install a bot account into a server you select",
    "applications.commands": "Register and use application commands",
    "webhook.incoming": "Create or use an incoming webhook"
};

const PERMISSIONS: Array<{ bit: number; name: string; description: string }> = [
    { bit: 0, name: "Create Instant Invite", description: "Create server invites" },
    { bit: 1, name: "Kick Members", description: "Remove members from a server" },
    { bit: 2, name: "Ban Members", description: "Ban members from a server" },
    { bit: 3, name: "Administrator", description: "Full server permissions, including overriding channel restrictions" },
    { bit: 4, name: "Manage Channels", description: "Create, edit, or delete channels" },
    { bit: 5, name: "Manage Server", description: "Change important server settings" },
    { bit: 7, name: "View Audit Log", description: "Read server audit-log entries" },
    { bit: 13, name: "Manage Messages", description: "Delete or pin messages" },
    { bit: 27, name: "Manage Nicknames", description: "Change other members' nicknames" },
    { bit: 28, name: "Manage Roles", description: "Create, edit, or assign roles" },
    { bit: 29, name: "Manage Webhooks", description: "Create, edit, or delete webhooks" },
    { bit: 30, name: "Manage Expressions", description: "Manage server emoji and stickers" },
    { bit: 33, name: "Manage Events", description: "Create, edit, or cancel server events" },
    { bit: 34, name: "Manage Threads", description: "Manage threads" },
    { bit: 40, name: "Moderate Members", description: "Timeout members" }
];

const AUTH_HOSTS = new Set(["discord.com", "discordapp.com"]);

function isDiscordHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    return AUTH_HOSTS.has(host) || [...AUTH_HOSTS].some(domain => host.endsWith("." + domain));
}

function isAuthorizationUrl(url: URL): boolean {
    return isDiscordHost(url.hostname) && /^\/(?:api\/)?oauth2\/authorize\/?$/i.test(url.pathname);
}

function getRequestedScopes(url: URL): string[] {
    return (url.searchParams.get("scope") || "")
        .split(/[\s+]+/)
        .map(scope => scope.trim().toLowerCase())
        .filter(Boolean);
}

function permissionValue(url: URL): bigint {
    const raw = url.searchParams.get("permissions");
    if (!raw || !/^\d+$/.test(raw)) return 0n;
    try {
        return BigInt(raw);
    } catch {
        return 0n;
    }
}

function hasPermission(value: bigint, bit: number): boolean {
    return (value & (1n << BigInt(bit))) !== 0n;
}

function collectRisks(url: URL, config: AuthorizationGuardSettings): AuthorizationRisk[] {
    const risks: AuthorizationRisk[] = [];
    const scopes = getRequestedScopes(url);
    const isBot = scopes.includes("bot");
    const permissions = permissionValue(url);

    for (const scope of scopes) {
        if (scope === "email" && !config.store.warnOnEmailScope) continue;
        if (["email"].includes(scope) && config.store.warnOnEmailScope) {
            risks.push({ title: "Email address", detail: SCOPE_DETAILS[scope] });
            continue;
        }
        if (config.store.warnOnSensitiveScopes && [
            "identify", "identify", "connections", "guilds", "guilds.members.read", "guilds.join",
            "role_connections.write", "dm_channels.read", "messages.read", "webhook.incoming"
        ].includes(scope)) {
            risks.push({ title: "Sensitive account or server access", detail: SCOPE_DETAILS[scope] || `Requested OAuth scope: ${scope}` });
        }
    }

    if (isBot) {
        risks.push({
            title: "Bot installation",
            detail: "A bot will be added to the server you choose. It can only see channels and messages its roles and channel permissions allow it to access, but authorized server content may be processed or stored by the bot operator."
        });
    }

    if (config.store.warnOnPrivilegedBotPermissions && permissions > 0n) {
        for (const permission of PERMISSIONS) {
            if (hasPermission(permissions, permission.bit)) {
                risks.push({
                    title: `Bot permission: ${permission.name}`,
                    detail: permission.description
                });
            }
        }
    }

    if (config.store.warnOnBotMessageAccess && isBot && hasPermission(permissions, 10)) {
        risks.push({
            title: "Channel message visibility",
            detail: hasPermission(permissions, 16)
                ? "The bot requests View Channel and Read Message History. It may read messages and available history in channels where its role has access; this does not automatically grant access to every private channel or your personal DMs."
                : "The bot requests View Channel. It may receive new messages in channels where its role has access; older message history is controlled separately by Read Message History."
        });
    }

    if (!scopes.length && permissions === 0n) {
        risks.push({
            title: "Authorization details unavailable",
            detail: "PrivacyToolkit could not read the requested scopes or permissions from this authorization URL. Review Discord's own authorization screen carefully."
        });
    }

    return risks;
}

let bypassAuthorizationElement: HTMLElement | undefined;
let installedHandler: ((event: MouseEvent) => void) | undefined;

function findAuthorizationElement(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    return target.closest("a[href],button,[role='button']") as HTMLElement | null;
}

function urlForElement(element: HTMLElement): URL | undefined {
    const href = element instanceof HTMLAnchorElement ? element.href : window.location.href;
    try {
        return new URL(href, window.location.href);
    } catch {
        return undefined;
    }
}

function shouldGuardElement(element: HTMLElement, url: URL): boolean {
    if (element instanceof HTMLAnchorElement) return isAuthorizationUrl(url);
    if (!isAuthorizationUrl(url)) return false;
    const label = (element.getAttribute("aria-label") || element.innerText || element.textContent || "").trim();
    return /^(authorize|authorize app|authorize bot|add bot|continue|approve|accept)$/i.test(label);
}

function openAuthorizationWarning(url: URL, risks: AuthorizationRisk[], element: HTMLElement) {
    const clientId = url.searchParams.get("client_id");
    const scopes = getRequestedScopes(url);
    const isBot = scopes.includes("bot");
    const title = isBot ? "Review bot installation" : "Review application access";

    openModal(modalProps => (
        <ConfirmModal
            {...modalProps}
            title={title}
            subtitle="PrivacyToolkit detected an authorization request with access that may expose personal or sensitive information."
            confirmText="Continue anyway"
            cancelText="Cancel authorization"
            variant="critical-primary"
            notice={{ type: "critical", message: "Data shared with an app or bot may be logged, retained, or copied into private databases or channels controlled by its operator. PrivacyToolkit cannot verify the developer's data-handling practices." }}
            onConfirm={() => {
                // Replay only this element's original action once, preserving
                // Discord's native route handling and target behavior.
                bypassAuthorizationElement = element;
                element.click();
                queueMicrotask(() => {
                    if (bypassAuthorizationElement === element) bypassAuthorizationElement = undefined;
                });
            }}
        >
            <div className="privacy-toolkit-auth-warning">
                <p><strong>Requested access to review:</strong></p>
                <ul>
                    {risks.map((risk, index) => (
                        <li key={index}>
                            <strong>{risk.title}:</strong> {risk.detail}
                        </li>
                    ))}
                </ul>
                {clientId && <p><strong>Application ID:</strong> <code>{clientId}</code></p>}
                <p>
                    Only continue if you recognize the application, trust its developer, and are comfortable
                    with the listed access. You can cancel now and review the app's privacy policy or request
                    fewer permissions first.
                </p>
                <p>
                    Discord permissions limit what a bot can access inside your server, but they do not control
                    what the operator does with information the bot legitimately receives.
                </p>
            </div>
        </ConfirmModal>
    ));
}

export function startAuthorizationGuard(config: AuthorizationGuardSettings) {
    if (installedHandler) return;

    installedHandler = (event: MouseEvent) => {
        if (bypassAuthorizationElement && (
            event.target === bypassAuthorizationElement ||
            (event.target instanceof Node && bypassAuthorizationElement.contains(event.target))
        )) {
            bypassAuthorizationElement = undefined;
            return;
        }

        const element = findAuthorizationElement(event.target);
        if (!element || !config.store.appAuthorizationGuardEnabled) return;
        const url = urlForElement(element);
        if (!url || !shouldGuardElement(element, url)) return;

        const risks = collectRisks(url, config);
        if (!risks.length) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openAuthorizationWarning(url, risks, element);
    };

    document.addEventListener("click", installedHandler, true);
}

export function stopAuthorizationGuard() {
    if (installedHandler) document.removeEventListener("click", installedHandler, true);
    installedHandler = undefined;
    bypassAuthorizationElement = undefined;
}
