// menu.ts
import { Menu, MenuBar, DockPanel, Panel, Widget } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import { RepositoryToolbar } from './menu-repos';
import { ScriptToolbar } from './menu-script';
import { ApplicationToolbar } from './menu-app';
import { FileToolbar } from './menu-file';
import { SettingsToolbar } from './menu-settings';
import { HistoryToolbar } from './menu-history';
import { LayoutAdjuster } from './lumino-widget';
import { loadAndInstantiate } from './babel-compile';
import { OUTLINE_WIDGET_TYPES, updateModifierPressed } from './lumino-resize';
import { FileManager } from './lumino-files';
import type { GlobalToolbarsWindow, LuminoMenuWindow, RepositorySettingsWindow } from './menu.d';
import type { LuminoLayoutWindow } from './lumino.d';
import type { EditorWindow } from '../editor/widget.d';
import { EditToolbar } from './menu-edit';
import { ViewToolbar } from './menu-view';
import { LayoutToolbar } from './menu-layout';


const menuSelf: RepositorySettingsWindow & LuminoMenuWindow & LuminoLayoutWindow & GlobalToolbarsWindow & EditorWindow = self as unknown as any;


export interface TopBarComponents
{
	headerRow: Panel;
	menuBar: MenuBar;
}


export interface TerminalFilter
{
	id: string;
	label: string;
}



export interface ComponentRoute
{
	label: string;
	url?: string;
	className?: string;
	iconClass: string; // The specific Boxicons layout string tokens
	description?: string;
	subtext?: string;
}

// 1. Unified metadata tree tracking every panel type and icon token
export const MODULE_REGISTRY: Record<string, ComponentRoute> = {
	'collapse': {
		label: 'Collapse',
		iconClass: 'bx bx-arrow-in-left-square-half',
		subtext: 'Requires Lumino DockPanel container references and UI state layout persistence.',
		description: 'Collapses active sidebars or secondary workspace panels to maximize primary viewing space across media and storage widgets.'
	},
	'searchlist': {
		label: 'Search Files',
		url: './components/filelist/widget-search.ts',
		className: 'SearchListWidget',
		iconClass: 'bx bx-search',
		subtext: 'Depends on indexed search database endpoints, debounced input triggers, and query-parsing regex modules.',
		description: 'An indexed filesystem search interface that queries local and remote metadata to rapidly retrieve shared media files, audio tracks, and archives.'
	},
	'fileview': {
		label: 'Shared Files',
		url: './components/fileview/widget.ts',
		className: 'FileviewWidget',
		iconClass: 'bx bx-folder-code',
		subtext: 'Requires SOCKS5/WebSocket stream proxies, local directory access APIs, and virtualized tree rendering contexts.',
		description: 'A browser-based remote filesystem explorer enabling secure browsing, directory sharing, and file operations across distributed network storage nodes.'
	},
	'music': {
		label: 'Music',
		url: './components/music/widget.ts',
		className: 'MusicWidget',
		iconClass: 'bx bx-music',
		subtext: 'Depends on Web Audio API, dynamic audio element binding, visualizer engine hooks, and crossfade timing managers.',
		description: 'A high-performance audio engine and playlist player supporting seamless track crossfading, audio visualization, and stream playback from remote storage.'
	},
	'photos': {
		label: 'Photos',
		url: './components/photo/widget.ts',
		className: 'PhotoWidget',
		iconClass: 'bx bx-camera-alt',
		subtext: 'Requires HTML5 Image canvas decoders, EXIF metadata extraction modules, and client-side thumbnail caching stores.',
		description: 'A photo collection browser equipped with EXIF inspection, high-resolution previewing, and slideshow controls for indexed photographic libraries.'
	},
	'images': {
		label: 'Images',
		url: './components/image/widget.ts',
		className: 'ImageWidget',
		iconClass: 'bx bx-image',
		subtext: 'Operates via CSS carousel drivers, pan/zoom canvas handlers, and multi-format raster/vector image readers.',
		description: 'A interactive image viewer supporting multi-directional carousel transitions, responsive image sliders, and deep-zoom inspection for remote asset stores.'
	},
	'videos': {
		label: 'Videos',
		url: './components/video/widget.ts',
		className: 'VideoWidget',
		iconClass: 'bx bx-video',
		subtext: 'Depends on HTML5 Video API, Media Source Extensions (MSE), and WebSocket telemetry streams for adaptive playback.',
		description: 'A versatile video streaming player capable of handling short clips, web-shared recordings, and adaptive stream sources with custom playback controls.'
	},
	'movies': {
		label: 'Movies',
		url: './components/movie/widget.ts',
		className: 'MovieWidget',
		iconClass: 'bx bx-movie',
		subtext: 'Integrates with TMDB/IMDb scrapers, server-side FFmpeg transcode queues, and HTTP Range request handlers.',
		description: 'A cinematic media library interface featuring automated metadata matching, real-time transcoding streams, and full movie playback controls.'
	},
	'games': {
		label: 'Games',
		url: './components/game/widget.ts',
		className: 'GameWidget',
		iconClass: 'bx bx-joystick',
		subtext: 'Requires WebAssembly (WASM) emulator runtimes, WebGL render target canvases, and Gamepad API event listeners.',
		description: 'An embedded web execution environment and browser-based emulator dashboard for launching, streaming, and interacting with remote game assets.'
	},

	// 'database': {
	//   label: 'Local Database',
	//   url: './components/filelist/widget-database.ts',
	//   className: 'DatabaseListWidget',
	//   iconClass: 'bx bx-database',
	//   subtext: 'Requires IndexedDB storage adapters, local SQLite WASM bindings, and automated schema migration scripts.',
	//   description: 'A client-side persistent storage inspector for tracking local file indices, media caches, and offline synchronization states.'
	// },
	'tools': {
		label: 'Tools',
		url: './components/tools/widget.ts',
		className: 'ToolsWidget',
		iconClass: 'bx bx-rename',
		subtext: 'Relies on system subprocess execution bridges, batch processing queues, and external automation service RPCs.',
		description: 'A centralized utility hub housing torrent procurement engines, transcode queue monitors, file renamers, and automated background media tools.'
	},
	// 'settings': {
	//   label: 'Edit Settings',
	//   url: './components/editor/widget-settings.ts',
	//   className: 'SettingsWidget',
	//   iconClass: 'bx bx-gear',
	//   subtext: 'Depends on local storage key-value stores, JSON configuration schemas, and live application theme managers.',
	//   description: 'A application configuration panel for managing transcode presets, remote network bindings, storage paths, and UI preferences.'
	// },
};


export const TOOLS_REGISTRY: Record<string, ComponentRoute> = {
	'torrent': {
		label: 'Torrents',
		url: './components/tools/widget-torrent.ts',
		className: 'TorrentWidget',
		iconClass: 'bx bx-archive-arrow-down',
		subtext: 'Requires WebTorrent / libtorrent Node native binding, DHT/P2P Socket layer, active TCP/UDP ports 6881-6889, and Local Storage session persistence.',
		description: 'An automated peer-to-peer file acquisition system designed to coordinate high-speed swarm downloads, parse magnet URIs, verify piece integrity, and orchestrate torrent lifecycle management.'
	},
	'nzb': {
		label: 'NZB & Usenet',
		url: './components/tools/widget-nzb.ts',
		className: 'NzbWidget',
		iconClass: 'bx bx-news',
		subtext: 'Depends on TLS/SSL NNTP socket transport, SABnzbd or NZBGet RPC endpoints, PAR2 repair utilities, and multi-part RAR decoding libraries.',
		description: 'A multi-threaded Usenet client manager capable of parsing XML-based NZB index files, assembling split binary segments across high-bandwidth NNTP connections, and running automated file repairs.'
	},
	'ripper': {
		label: 'Movie Finder',
		url: './components/tools/widget-movies.ts',
		className: 'MoviesWidget',
		iconClass: 'bx bx-film',
		subtext: 'Integrates with TMDB / IMDb REST APIs, Radarr API v3, OMDb metadata scrapers, and fuzzy string-matching regex modules.',
		description: 'An intelligent cinematic media crawler that queries indexers for releases, analyzes metadata profiles against media quality rules, and automatically matches releases with high-accuracy IMDB metadata.'
	},
	'tv': {
		label: 'TV Subscriptions',
		url: './components/tools/widget-tv.ts',
		className: 'TvWidget',
		iconClass: 'bx bx-tv',
		subtext: 'Relies on TVDB API v4, Sonarr GraphQL/REST interfaces, MyEpisodes RSS feed authentication, and cron scheduling daemons.',
		description: 'A comprehensive episodic television management engine that tracks release schedules, orchestrates series monitoring, and synchronizes watch history across third-party tracking portals.'
	},
	'renamer': {
		label: 'Batch Renamer',
		url: './components/tools/widget-renamer.ts',
		className: 'RenamerWidget',
		iconClass: 'bx bx-rename',
		subtext: 'Uses Node.js `fs-extra` module, cross-platform POSIX path utilities, custom template engine parsing, and dry-run diffing pipelines.',
		description: 'A structural batch file organization tool that parses raw filenames into normalized naming schemas, handles multi-directory relocation, and executes instant filesystem renames.'
	},
	'tagger': {
		label: 'ID3 Tag Editor',
		url: './components/tools/widget-tagger.ts',
		className: 'TaggerWidget',
		iconClass: 'bx bx-price-tag-alt',
		subtext: 'Requires `node-id3`, `music-metadata` parser engine, FFmpeg audio probe bindings, and embedded cover art buffer readers.',
		description: 'An advanced audio metadata editor built to inspect, extract, and write ID3v2 tags, embedded album artwork, variable bitrate headers, and canonical track metadata directly into audio streams.'
	},
	'status': {
		label: 'Transcoder Queue',
		url: './components/status/widget.ts',
		className: 'WorkerStatusWidget',
		iconClass: 'bx bx-cog',
		subtext: 'Operates via BullMQ / Redis message broker, WebWorker thread pool poolers, FFmpeg CLI subprocess runners, and WebSocket telemetry status frames.',
		description: 'A dynamic background task monitor that provides real-time oversight for hardware-accelerated video transcoding, worker health metrics, queue priority distribution, and stream encoding pipelines.'
	},
	'github': {
		label: 'Github Commit',
		url: './components/filelist/widget-github.ts',
		className: 'GithubListWidget',
		iconClass: 'bx bx-git-repo-forked',
		subtext: 'Requires GitHub REST/GraphQL API tokens, simple-git subprocess wrapper, SSH key agent credentials, and git-log JSON parsers.',
		description: 'A repository history and version control dashboard that tracks commit trees, diff histories, remote pull requests, and automated sync events across local and remote repositories.'
	},
	'terminal-container': {
		label: 'Show Console',
		url: './components/terminal/widget.ts',
		className: 'TerminalWidget',
		iconClass: 'bx bx-terminal',
		subtext: 'Powered by Xterm.js canvas rendering context, WebSocket pty gateway daemon, UTF-8 streaming codecs, and node-pty process forks.',
		description: 'An embedded interactive terminal emulator offering full pseudo-terminal (PTY) capabilities, customizable color themes, shell execution, and live stdout/stderr stream monitoring.'
	},
	'graph': {
		label: 'Workflow Graph',
		url: './components/graph/widget.ts',
		className: 'LightGraphWidget',
		iconClass: 'bx bx-chart-stacked-rows',
		subtext: 'Built on Canvas2D / WebGL rendering context, LightGraph.js node engine, DAG execution pipelines, and JSON graph serialization formats.',
		description: 'A visual node-based execution canvas for orchestrating media pipelines, connecting step-by-step automation workflows, and visually inspecting event-driven data flow branches.'
	}
};

menuSelf.MODULE_REGISTRY = MODULE_REGISTRY;
menuSelf.TOOLS_REGISTRY = TOOLS_REGISTRY;

export const TERMINAL_REGISTRY: TerminalFilter[] = [
	// Log Levels & Diagnostics
	{ id: 'all', label: 'All Logs' },
	{ id: 'error', label: 'Errors' },
	{ id: 'warn', label: 'Warnings' },

	// Core UI & Systems
	{ id: 'soft', label: 'CLI Render' },    // Matches your custom terminal viewport / frame limiter
	{ id: 'build', label: 'Build' },        // Compiler, AST parsers, build chains
	{ id: 'runtime', label: 'Runtime Dev' }, // Main loop, tasks, orchestration

	// Network & Background
	{ id: 'network', label: 'Network' },    // Custom meshes, P2P syncing, OAuth channels
	{ id: 'console', label: 'Console' },    // Standard fallback stdout / logging intercepts
	{ id: 'ai', label: 'AI Integration' }   // Local models, WebGPU memory, inference steps
];


menuSelf.TERMINAL_REGISTRY = TERMINAL_REGISTRY;


export async function triggerPanelRoute(panelId: string, mainDock: DockPanel, noHide: boolean = false): Promise<void>
{
	const route = MODULE_REGISTRY[panelId];
	/*TODO: this applied only to file open
	if(panelId === 'viewport-frame')
	{
		const preferredRenderer = SettingsManager.get('toji', 'preferredRenderer');
		if(preferredRenderer === 'nunu')
		{
			route = MODULE_REGISTRY['nunu'];
		}
	}*/
	if(!route || !route.url)
	{
		console.log('Panel route not found: ' + panelId);
		return; // Skip routes without code targets (like collapse)
	}

	try
	{
		// 1. Gather active DOM widgets
		const currentDOMWidgets = Array.from(mainDock.widgets());

		// 2. Identify target instances stored in memory
		let targetMemoryWidgets: Widget[] = [];

		if(route.className === 'TerminalWidget')
		{
			targetMemoryWidgets = menuSelf.terminalWidgets || [];
		} else if(route.className && OUTLINE_WIDGET_TYPES.includes(route.className))
		{
			targetMemoryWidgets = (menuSelf.fileListWidgets || []).filter(
				(w: any) => w.constructor.name === route.className
			);
		}

		// Find if a matching widget is mounted in the DOM dock
		const matchingDOMWidget = currentDOMWidgets.find(
			domWidget => domWidget.constructor.name === route.className
		);

		// 3. Handle toggling and activation
		if(targetMemoryWidgets.length > 0)
		{
			console.log('Panel route already loaded in memory: ' + panelId);

			if(matchingDOMWidget && !noHide)
			{
				// Lumino check: Widget is active on top if it's currently selected in its dock tab area
				// and its root node isn't hidden by display: none
				const selectedWidgets = typeof (mainDock as any).selectedWidgets === 'function'
					? Array.from((mainDock as any).selectedWidgets())
					: [];

				const isTabSelectedOnTop = selectedWidgets.includes(matchingDOMWidget) ||
					(matchingDOMWidget.isVisible && matchingDOMWidget.node.style.display !== 'none');

				if(isTabSelectedOnTop)
				{
					// Already active and visible on top -> Collapse/Hide
					collapseWidgets(mainDock, true, route);
				} else
				{
					// Mounted in DOM, but hidden behind another tab -> Activate & bring to top
					mainDock.activateWidget(matchingDOMWidget);
					if(typeof matchingDOMWidget.activate === 'function')
					{
						matchingDOMWidget.activate();
					}
				}
			} else
			{
				// Exists in memory but completely removed/detached from DOM -> Expand/Restore
				collapseWidgets(mainDock, false, route);

				targetMemoryWidgets.forEach(w =>
				{
					if(typeof w.show === 'function') w.show();
				});

				mainDock.activateWidget(targetMemoryWidgets[0]);
				if(typeof targetMemoryWidgets[0].activate === 'function')
				{
					targetMemoryWidgets[0].activate();
				}
			}
			return;
		}


		if(matchingDOMWidget)
		{
			console.log('Panel route already loaded: ' + panelId);
			matchingDOMWidget.show();
			mainDock.activateWidget(matchingDOMWidget);
			matchingDOMWidget.activate();
			return;
		}


		const widgetInstance = await loadAndInstantiate(route);
		if(widgetInstance.constructor.name === 'TerminalWidget')
		{
			LayoutAdjuster.addOptimalWidgetLayout(mainDock, widgetInstance, {
				type: 'terminal',
				projectId: widgetInstance.constructor.name
			});
		}
		else if(OUTLINE_WIDGET_TYPES.includes(widgetInstance.constructor.name))
		{
			LayoutAdjuster.addOptimalWidgetLayout(mainDock, widgetInstance, {
				type: 'outline',
				projectId: widgetInstance.constructor.name
			});
		} else
		{
			LayoutAdjuster.addOptimalWidgetLayout(mainDock, widgetInstance, {
				type: 'editor',
				projectId: widgetInstance.constructor.name
			});
		}

		await new Promise(resolve =>
		{
			window.requestAnimationFrame(resolve);
		});
	} catch(err)
	{
		console.error(`Module initialization fault on pathway [${panelId}]:`, err);
	}
}


menuSelf.triggerPanelRoute = triggerPanelRoute;


function initializeTabsMenu(commands: CommandRegistry, mainDock: DockPanel, viewMenu: Menu)
{

	// 0. setup tabs menu
	commands.addCommand('select-tab', {
		iconClass: 'bx bx-tabs',
		label: (args) =>
		{
			return Array.from(mainDock.widgets()).find(w =>
			{
				return w.id === args.value;
			})?.title.label
				?? (args.label as string) ?? 'Select Tab';
		},
		execute: (args: any) =>
		{
			Array.from(mainDock.widgets()).forEach(w =>
			{
				if(w.id === args.value)
				{
					mainDock.activateWidget(w);
					w.activate();
				}
			});
		}
	});

	commands.addCommand('next-tab', {
		label: 'Next Tab',
		iconClass: 'bx bx-chevron-right-square',
		isEnabled: () =>
		{
			return true;
			// Optional: don't switch tabs if the user is typing in a text field
			//const active = document.activeElement;
			//const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
			//return !isTyping;
		},
		execute: () =>
		{
			if(!menuSelf.lastInteractedWidget)
			{
				return;
			}
			const widgets = Array.from(mainDock.widgets());
			const currentWidgetIndex = widgets.indexOf(menuSelf.lastInteractedWidget);
			if(currentWidgetIndex === widgets.length - 1)
			{
				menuSelf.lastInteractedWidget = widgets[0];
				mainDock.activateWidget(widgets[0]);
				widgets[0].activate();
			} else
			{
				menuSelf.lastInteractedWidget = widgets[currentWidgetIndex + 1];
				mainDock.activateWidget(widgets[currentWidgetIndex + 1]);
				widgets[currentWidgetIndex + 1].activate();
			}
			return false;
		}
	});
	commands.addCommand('previous-tab', {
		label: 'Previous Tab',
		iconClass: 'bx bx-chevron-left-square',
		isEnabled: () =>
		{
			return true;
			//const active = document.activeElement;
			//const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
			//return !isTyping;
		},
		execute: () =>
		{
			if(!menuSelf.lastInteractedWidget)
			{
				return;
			}
			const widgets = Array.from(mainDock.widgets());
			const currentWidgetIndex = widgets.indexOf(menuSelf.lastInteractedWidget);
			if(currentWidgetIndex === 0)
			{
				menuSelf.lastInteractedWidget = widgets[widgets.length - 1];
				mainDock.activateWidget(widgets[widgets.length - 1]);
				widgets[widgets.length - 1].activate();
			} else
			{
				menuSelf.lastInteractedWidget = widgets[currentWidgetIndex - 1];
				mainDock.activateWidget(widgets[currentWidgetIndex - 1]);
				widgets[currentWidgetIndex - 1].activate();
			}
		}
	});

	commands.addKeyBinding({
		command: 'previous-tab',
		keys: ['Alt N'],
		selector: '*'
	});
	commands.addKeyBinding({
		command: 'next-tab',
		keys: ['Alt M'],
		selector: '*'
	});

	const tabsMenu = new Menu({ commands });
	tabsMenu.title.label = 'Open Tabs';
	tabsMenu.title.iconClass = 'bx bx-tabs';
	menuSelf.tabsMenu = tabsMenu;
	viewMenu.addItem({ type: 'submenu', submenu: tabsMenu });
	viewMenu.addItem({ type: 'separator' });
	tabsMenu.addItem({ type: 'separator' });
	tabsMenu.addItem({ command: 'next-tab' });
	tabsMenu.addItem({ command: 'previous-tab' });


}




/**
 * System Context Initialization
 */
export function initializeMenus(commands: CommandRegistry, menuBar: MenuBar, mainDock: DockPanel, toolbarNode: HTMLElement): void
{
	document.addEventListener('keydown', (event: KeyboardEvent) =>
	{
		commands.processKeydownEvent(event);
		updateModifierPressed(event);

	}, true);
	document.addEventListener('keyup', (event: KeyboardEvent) =>
	{
		commands.processKeyupEvent(event);
		updateModifierPressed(event);

	}, true);

	const viewMenu = new Menu({ commands });
	viewMenu.title.label = 'Window';

	initializeTabsMenu(commands, mainDock, viewMenu);

	// 1. Render the HTML list structural tree directly inside the left toolbar container node
	const ul = document.createElement('ul');
	Object.entries(MODULE_REGISTRY).forEach(([id, route]) =>
	{
		const li = document.createElement('li');
		const a = document.createElement('a');
		a.setAttribute('href', `#${id}`);
		a.setAttribute('title', route.label);
		a.className = route.iconClass;

		// Set 'active' style override state specifically for your engine files entry point
		if(id === 'filelist')
		{
			a.classList.add('active');
		}

		li.appendChild(a);
		ul.appendChild(li);

		// 2. Map standard commands to Top Menu Bar targets (skipping collapse navigation)
		if(route.url)
		{
			const commandId = `spawn-panel:${id}`;
			commands.addCommand(commandId, {
				label: route.label,
				iconClass: route.iconClass, // <-- Add this line to attach the Boxicon classes to the command
				execute: () => triggerPanelRoute(id, mainDock)
			});
			viewMenu.addItem({ command: commandId });
		}
	});

	toolbarNode.appendChild(ul);
	menuBar.addMenu(viewMenu);

	// 3. Isolated internal event capture handling bounded to the toolbar container
	toolbarNode.addEventListener('click', mainModuleHandler.bind(toolbarNode, mainDock, toolbarNode));
}


function mainModuleHandler(mainDock: DockPanel, toolbarNode: HTMLElement, event: MouseEvent)
{
	const anchor = (event.target as HTMLElement).closest('a');
	if(!anchor) return;

	const href = anchor.getAttribute('href');
	if(href && href.startsWith('#'))
	{
		event.preventDefault();
		const panelId = href.substring(1);

		// Manage localized highlight toggle styles across the sidebar icons
		toolbarNode.querySelectorAll('a').forEach(el => el.classList.remove('active'));
		if(panelId !== 'collapse')
		{
			anchor.classList.add('active');
		} else
		{
			const shouldCollapse = (menuSelf.fileListWidgets && menuSelf.fileListWidgets.length > 0)
				|| (menuSelf.terminalWidgets && menuSelf.terminalWidgets.length > 0);
			if(!shouldCollapse)
			{
				return;
			}
			console.log('Panel singleton toggle: ' + panelId);
			if(toolbarNode.classList.contains('collapsed'))
			{
				toolbarNode.classList.remove('collapsed');
				collapseWidgets(mainDock, false);
			} else
			{
				toolbarNode.classList.add('collapsed');
				collapseWidgets(mainDock, true);
			}
			return;
		}

		triggerPanelRoute(panelId, mainDock);
	}
}


function collapseWidgets(mainDock: DockPanel, collapse: boolean, route?: ComponentRoute)
{
	if(menuSelf.fileListWidgets && menuSelf.fileListWidgets.length > 0
		&& (!route || route.className && OUTLINE_WIDGET_TYPES.includes(route.className))
	)
	{
		if(collapse)
		{
			for(let widget of menuSelf.fileListWidgets)
			{
				widget.hide();
				widget.parent = null;
			}
		} else
		{
			for(let widget of menuSelf.fileListWidgets)
			{
				LayoutAdjuster.addOptimalWidgetLayout(mainDock, widget, {
					type: 'outline',
					projectId: widget.constructor.name
				});
			}
		}
	}

	if(menuSelf.terminalWidgets && menuSelf.terminalWidgets.length > 0
		&& (!route || route.className && route.className === 'TerminalWidget')
	)
	{
		if(collapse)
		{
			for(let widget of menuSelf.terminalWidgets)
			{
				widget.hide();
				widget.parent = null;
			}
		} else
		{
			for(let widget of menuSelf.terminalWidgets)
			{
				LayoutAdjuster.addOptimalWidgetLayout(mainDock, widget, {
					type: 'terminal',
					projectId: widget.constructor.name
				});
			}
		}
	}

	window.requestAnimationFrame(() =>
	{
		menuSelf.resizeHandler?.();
		setTimeout(() =>
		{
			menuSelf.resizeHandler?.();
		}, 200);
	});
}





/**
 * Main export to assemble and return the unified top header row.
 */
export function createTopBar(commands: CommandRegistry): TopBarComponents
{
	// 3. Assemble the base MenuBar
	const menuBar = new MenuBar({
		overflowMenuOptions: {
			isVisible: false
		}
	});
	menuSelf.globalMenuBar = menuBar;
	menuBar.id = 'top-menubar';

	const headerRow = new Panel();
	headerRow.id = 'app-top-header-row';
	headerRow.node.style.minHeight = '30px';

	// 4. Build the inline toolbar segment
	const repositoryToolbar = RepositoryToolbar.getInstance().initialize(commands);
	menuSelf.repositoryToolbar = repositoryToolbar;
	const scriptToolbar = ScriptToolbar.getInstance().initialize(commands);
	menuSelf.scriptToolbar = scriptToolbar;
	const appToolbar = ApplicationToolbar.getInstance().initialize(commands);
	menuSelf.appToolbar = appToolbar;
	const fileToolbar = FileToolbar.getInstance().initialize(commands);
	menuSelf.fileToolbar = fileToolbar;
	const editToolbar = EditToolbar.getInstance().initialize(commands);
	menuSelf.editToolbar = editToolbar;
	const viewToolbar = ViewToolbar.getInstance().initialize(commands);
	menuSelf.viewToolbar = viewToolbar;
	const layoutToolbar = LayoutToolbar.getInstance().initialize(commands);
	menuSelf.layoutToolbar = layoutToolbar;
	const historyToolbar = HistoryToolbar.getInstance().initialize(commands);
	menuSelf.historyToolbar = historyToolbar;
	const settingsToolbar = SettingsToolbar.getInstance().initialize(commands);
	menuSelf.settingsToolbar = settingsToolbar;

	headerRow.addWidget(menuBar);
	headerRow.addWidget(repositoryToolbar);
	headerRow.addWidget(scriptToolbar);
	headerRow.addWidget(appToolbar);
	headerRow.addWidget(fileToolbar);
	headerRow.addWidget(editToolbar);
	headerRow.addWidget(viewToolbar);
	headerRow.addWidget(layoutToolbar);
	headerRow.addWidget(historyToolbar);
	headerRow.addWidget(settingsToolbar);

	return { headerRow, menuBar };
}


let hashDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Parses and dispatches hash navigation routes.
 */
export async function renderHashCommand(targetHashName: string, noBounce: boolean = false): Promise<void>
{
	const rawTarget = (targetHashName || '').trim().replace(/^#/, '');

	if(hashDebounceTimer)
	{
		clearTimeout(hashDebounceTimer);
		hashDebounceTimer = null;
	}

	if(!noBounce)
	{
		hashDebounceTimer = setTimeout(() =>
		{
			renderHashCommand(rawTarget, true);
		}, 100);
		return;
	}

	if(!rawTarget || rawTarget.length === 0) return;
	menuSelf.previousHashLineNumber = null;

	const matchedRoute = MODULE_REGISTRY[rawTarget];
	if(matchedRoute)
	{
		// Activate registered panel/widget via your main dock panel router
		if(menuSelf.mainDock)
		{
			await triggerPanelRoute(rawTarget, menuSelf.mainDock, true);
		}
		return;
	}

	const matchedTerminal = TERMINAL_REGISTRY.find(t => t.id === rawTarget);
	if(matchedTerminal)
	{
		if(menuSelf.mainDock)
		{
			await triggerPanelRoute('terminal-container', menuSelf.mainDock, true);
		}

		const currentDOMWidgets = Array.from(menuSelf.mainDock?.widgets() ?? []);

		// Locate any active TerminalWidget whose filterId or DOM element ID matches target
		const existingTerminalWidget = currentDOMWidgets.find((w: any) =>
			w.constructor?.name === 'TerminalWidget' &&
			(w.filterId === rawTarget || w.id === `terminal-panel-${rawTarget}` || w.id === rawTarget)
		);

		if(existingTerminalWidget)
		{
			// Activate and bring tab to front immediately
			menuSelf.mainDock?.activateWidget(existingTerminalWidget);
			existingTerminalWidget.activate();
			return;
		}
	}

	try
	{
		await FileManager.navigateFile(rawTarget);
	} catch(err)
	{
		console.error(`[HashRouter] Failed to resolve target file path for hash #${rawTarget}:`, err);
	}
}

// ─── POPSTATE LISTENER BINDING ───
if(typeof window !== 'undefined')
{
	window.addEventListener('popstate', () =>
	{
		const activeHash = window.location.hash.substring(1);
		renderHashCommand(activeHash);
	});

	window.addEventListener('mousemove', (e: MouseEvent) =>
	{
		const globalTooltip = document.getElementById('global-tooltip');

		if(!globalTooltip) return;

		const target = e.target as HTMLElement;

		let targetEl: HTMLElement | null = null;
		let targetText: string | null | undefined = "";

		// 1. ISOLATED CHECK: Look for attributes assigned dynamically by our native plugin layer
		const aceContainer = target?.closest('.ace_editor') as HTMLElement;
		if(aceContainer)
		{
			// Pull error string markers
			targetText ||= aceContainer.getAttribute('data-compiler-error');

			// Pull code reference definition markers
			let navSymbol = aceContainer.getAttribute('data-navigation-target');
			if(navSymbol)
			{
				targetText = `Go to reference for definition: "${navSymbol}"`;
			}

			if(targetText)
			{
				targetEl = aceContainer;
			}
		}

		// 2. STANDARD MINIPAINT DOM ATTR FALLBACKS
		if(!targetText)
		{
			targetText ||= target.getAttribute('placeholder');
			targetText ||= target.getAttribute('alt');
			targetText ||= target.getAttribute('data-tooltip');
			targetText ||= target.getAttribute('title');
			if(targetText)
			{
				targetEl = target;
			}
		}

		if(!targetText && target.parentElement)
		{
			targetText ||= target.parentElement.getAttribute('placeholder');
			targetText ||= target.parentElement.getAttribute('alt');
			targetText ||= target.parentElement.getAttribute('data-tooltip');
			targetText ||= target.parentElement.getAttribute('title');
			if(targetText)
			{
				targetEl = target.parentElement;
			}
		}

		const closest = target.closest('[placeholder],[alt],[data-tooltip],[title],.pk_tb .pk_btn') as HTMLElement;
		if(!targetText && closest)
		{
			targetText ||= closest.getAttribute('placeholder');
			targetText ||= closest.getAttribute('alt');
			targetText ||= closest.getAttribute('data-tooltip');
			targetText ||= closest.getAttribute('title');
			targetText ||= closest.querySelector('span')?.innerText;
			if(targetText)
			{
				targetEl = closest;
			}
		}

		if(targetEl && targetEl.style.display === 'contents')
		{
			targetEl = targetEl.children[0] as HTMLElement;
		}


		if(!targetEl || !targetText)
		{
			globalTooltip.style.display = 'none';
			globalTooltip.style.opacity = '0';
			globalTooltip.style.zIndex = '-1';
			return;
		}

		if(!targetText) return;

		const hideAceErrors = document.querySelector('#global-editor-tooltip') as HTMLElement;
		if(hideAceErrors)
		{
			hideAceErrors.style.display = 'none';
		}

		globalTooltip.innerText = targetText;
		globalTooltip.style.display = 'block';
		globalTooltip.style.opacity = '1';
		globalTooltip.style.visibility = 'visible';
		globalTooltip.style.zIndex = '1000';

		// Fluid position layout tracking for tracking paths cleanly under cursor coordinates
		if(aceContainer)
		{
			globalTooltip.style.top = (e.clientY + 15) + 'px';
			globalTooltip.style.left = Math.min(e.clientX + 10, window.innerWidth - globalTooltip.clientWidth - 20) + 'px';
		} else
		{
			const rect = targetEl.getBoundingClientRect();
			globalTooltip.style.top = (rect.top + targetEl.clientHeight) + 'px';
			globalTooltip.style.left = Math.min(rect.left + targetEl.clientWidth, window.innerWidth - globalTooltip.clientWidth - 20) + 'px';
		}
	});
}

