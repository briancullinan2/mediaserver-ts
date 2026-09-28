import { CommandRegistry } from "@lumino/commands";
import { DockPanel, Widget } from "@lumino/widgets";
import { triggerPanelRoute } from "./menu";
import { SettingsManager } from "./settings";
import { loadAndInstantiate } from "./babel-compile";
import { LayoutAdjuster } from "./lumino-widget";
import { LuminoLayoutNode, serializeDockLayout } from "./lumino-resize";
import type { GlobalToolbarsWindow } from "./menu.d";
import type { LuminoLayoutWindow } from "./lumino.d";

const menuSelf: GlobalToolbarsWindow & LuminoLayoutWindow = self as unknown as any;

export class ApplicationToolbar extends Widget
{
	private static _instance: ApplicationToolbar | null = null;
	private _commands: CommandRegistry | null = null;

	private constructor()
	{
		super();
		this.id = 'application-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): ApplicationToolbar
	{
		if(!ApplicationToolbar._instance)
		{
			ApplicationToolbar._instance = new ApplicationToolbar();
			menuSelf.appToolbar = ApplicationToolbar._instance;
		}
		return ApplicationToolbar._instance;
	}

	public initialize(commands: CommandRegistry): ApplicationToolbar
	{
		this._commands = commands;
		this._registerCommands();
		return this;
	}

	private _registerCommands()
	{
		if(!this._commands)
		{
			return;
		}

		if(!this._commands.hasCommand('app-github-login'))
		{
			this._commands.addCommand('app-github-login', {
				label: 'Github Login',
				iconClass: 'bx bx-key',
				execute: async () =>
				{
					window.open('https://github.com/settings/tokens?type=beta', '_blank');
					const modal = await loadAndInstantiate({
						label: 'Enter Github Token',
						url: './components/layout/token-modal.ts',
						className: 'TokenModal',
						iconClass: 'bx bx-key'
					});
					modal.updatePlaceholder();
				}
			});
		}

		if(!this._commands.hasCommand('app-toggle-console'))
		{
			this._commands.addCommand('app-toggle-console', {
				label: 'Console',
				iconClass: 'bx bx-terminal',
				execute: async () =>
				{
					if(menuSelf.mainDock)
					{
						await triggerPanelRoute('terminal-container', menuSelf.mainDock);
					}
				}
			});
		}

		if(!this._commands.hasCommand('app-edit-settings'))
		{
			this._commands.addCommand('app-edit-settings', {
				label: 'Edit Settings',
				iconClass: 'bx bx-gear',
				execute: async () =>
				{
					const [fileId, fileName, settingsJson] = await SettingsManager.settings();
					menuSelf.AceEditorWidget?.openFileInNewTab(fileId ?? 'settings.json', fileName ?? 'settings.json', settingsJson ?? '');
				}
			});
		}

		if(!this._commands.hasCommand('app-share-link'))
		{
			this._commands.addCommand('app-share-link', {
				label: 'Shareable Link',
				iconClass: 'bx bx-share',
				execute: () =>
				{
					// TODO: reverse proxy setup
					navigator.clipboard.writeText(window.location.href);
				}
			});
		}

	}

	private _buildInterface(): void
	{
		this.node.innerHTML = `
            <button id="top-bar-btn-github" title="Github Login" class="bx bx-key"></button>
            <button id="top-bar-btn-console" title="Console" class="bx bx-terminal"></button>
            <button id="top-bar-btn-settings" title="Edit Settings" class="bx bx-gear"></button>
            <button id="top-bar-btn-link" title="Sharable Link" class="bx bx-share"></button>
        `;

		this.node.querySelector('#top-bar-btn-github')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-github-login');
		});

		this.node.querySelector('#top-bar-btn-console')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-toggle-console');
		});

		this.node.querySelector('#top-bar-btn-settings')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-edit-settings');
		});

		this.node.querySelector('#top-bar-btn-link')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-share-link');
		});

	}
}

menuSelf.ApplicationToolbar = ApplicationToolbar;

