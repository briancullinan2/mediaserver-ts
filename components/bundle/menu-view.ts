import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";
import { MenuConfig, MenuManager } from "./menu-manager";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "./menu.d";
import type { EditorWindow } from "../editor/widget.d";
import type { FileSystemWindow, LuminoLayoutWindow } from "./lumino.d";

type ExtendedWindow = LuminoMenuWindow & FileSystemWindow & LuminoLayoutWindow
	& GlobalToolbarsWindow & EditorWindow;

const menuSelf: ExtendedWindow = self as unknown as any;

export const VIEW_MENU: MenuConfig = {
	name: "View",
	iconClass: "bx bx-eye",
	children: [
		{
			name: "Layout Modes",
			iconClass: "bx bx-layout",
			children: [
				{
					name: "Toggle Split View",
					target: "view/layout.toggle_split",
					iconClass: "bx bx-columns"
				},
				{
					name: "Toggle Inspector Panel",
					target: "view/layout.toggle_inspector",
					iconClass: "bx bx-info-circle"
				},
				{
					name: "Toggle Hidden Files",
					target: "view/options.toggle_hidden",
					iconClass: "bx bx-eye-slash"
				}
			]
		},
		{
			name: "Display Views",
			iconClass: "bx bx-slideshow",
			children: [
				{
					name: "Netflix Rows",
					target: "view/mode.netflix",
					iconClass: "bx bx-film"
				},
				{
					name: "Coverflow",
					target: "view/mode.coverflow",
					iconClass: "bx bx-gallery-horizontal"
				},
				{
					name: "Grid",
					target: "view/mode.grid",
					iconClass: "bx bx-grid"
				},
				{
					name: "Details List",
					target: "view/mode.details",
					iconClass: "bx bx-list-ul"
				},
				{
					name: "Subtree View",
					target: "view/mode.tree",
					iconClass: "bx bx-git-repo-forked"
				}
			]
		},
		{ divider: true },
		{
			name: "Zoom",
			iconClass: "bx bx-search-alt",
			children: [
				{
					name: "Zoom In",
					shortcut: "Ctrl+=",
					target: "view/zoom.in",
					iconClass: "bx bx-search-plus"
				},
				{
					name: "Zoom Out",
					shortcut: "Ctrl+-",
					target: "view/zoom.out",
					iconClass: "bx bx-search-minus"
				},
				{ divider: true },
				{
					name: "Original Size",
					target: "view/zoom.original",
					iconClass: "bx bx-size-uniform"
				},
				{
					name: "Fit Window",
					target: "view/zoom.auto",
					iconClass: "bx bx-fullscreen"
				}
			]
		},
		{
			name: "Guides",
			iconClass: "bx bx-border-inner",
			children: [
				{
					name: "Insert",
					ellipsis: true,
					target: "view/guides.insert",
					iconClass: "bx bx-plus"
				},
				{
					name: "Update",
					target: "view/guides.update",
					iconClass: "bx bx-directions"
				},
				{
					name: "Remove all",
					target: "view/guides.remove",
					iconClass: "bx bx-trash"
				}
			]
		},
		{
			name: "Ruler",
			target: "view/ruler.ruler",
			iconClass: "bx bx-ruler"
		},
		{ divider: true },
		{
			name: "Full Screen",
			target: "view/full_screen.fs",
			iconClass: "bx bx-fullscreen"
		}
	]
};

export class ViewToolbar extends Widget
{
	private static _instance: ViewToolbar | null = null;
	private _commands: CommandRegistry | null = null;

	public showHiddenFiles: boolean = false;
	public activeViews: Set<string> = new Set(['grid']);
	public currentSort: string = 'name-asc';
	public currentGroup: string = 'none';

	private constructor()
	{
		super();
		this.id = 'view-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): ViewToolbar
	{
		if(!ViewToolbar._instance)
		{
			ViewToolbar._instance = new ViewToolbar();
			menuSelf.viewToolbar = ViewToolbar._instance;
		}
		return ViewToolbar._instance;
	}

	public initialize(commands: CommandRegistry): ViewToolbar
	{
		this._commands = commands;
		menuSelf.registerAllCommands?.(VIEW_MENU);
		MenuManager.injectMenus(null, VIEW_MENU);
		return this;
	}

	private _buildInterface(): void
	{
		this.node.innerHTML = `
            <div class="ribbon-group view-controls">
                <label class="toggle-switch" for="toggle-hidden-files" title="Show/Hide Hidden Files">
                    <input type="checkbox" id="toggle-hidden-files" ${this.showHiddenFiles ? 'checked' : ''} />
                    <span class="toggle-label"><i class="bx bx-eye-slash"></i> Hidden</span>
                </label>
                <select id="sort-select" class="ribbon-select" title="Sort Items">
                    <option value="name-asc" ${this.currentSort === 'name-asc' ? 'selected' : ''}>Name (A-Z)</option>
                    <option value="name-desc" ${this.currentSort === 'name-desc' ? 'selected' : ''}>Name (Z-A)</option>
                    <option value="date-desc" ${this.currentSort === 'date-desc' ? 'selected' : ''}>Date Modified</option>
                    <option value="size-desc" ${this.currentSort === 'size-desc' ? 'selected' : ''}>Size</option>
                    <option value="type" ${this.currentSort === 'type' ? 'selected' : ''}>File Type</option>
                </select>
                <select id="group-select" class="ribbon-select" title="Group Items">
                    <option value="none" ${this.currentGroup === 'none' ? 'selected' : ''}>No Grouping</option>
                    <option value="type" ${this.currentGroup === 'type' ? 'selected' : ''}>Group by Type</option>
                    <option value="date" ${this.currentGroup === 'date' ? 'selected' : ''}>Group by Date</option>
                </select>
            </div>

			<div class="view-switcher-buttons">
				<button class="view-btn ${this.activeViews.has('netflix') ? 'active' : ''}" data-view="netflix" title="Netflix Rows">
					<i class="bx bx-film"></i> Netflix
				</button>
				<button class="view-btn ${this.activeViews.has('coverflow') ? 'active' : ''}" data-view="coverflow" title="Coverflow">
					<i class="bx bx-gallery-horizontal"></i> Coverflow
				</button>
				<button class="view-btn ${this.activeViews.has('grid') ? 'active' : ''}" data-view="grid" title="Icon Grid">
					<i class="bx bx-grid"></i> Grid
				</button>
				<button class="view-btn ${this.activeViews.has('details') ? 'active' : ''}" data-view="details" title="Details List">
					<i class="bx bx-list-ul"></i> Details
				</button>
				<button class="view-btn ${this.activeViews.has('tree') ? 'active' : ''}" data-view="tree" title="Subtree Widget Instance">
					<i class="bx bx-git-repo-forked"></i> Subtree
				</button>
			</div>
        `;

		this._bindEvents();
	}

	private _bindEvents(): void
	{
		const checkbox = this.node.querySelector('#toggle-hidden-files') as HTMLInputElement;
		checkbox?.addEventListener('change', () =>
		{
			this.showHiddenFiles = checkbox.checked;
			this._commands?.execute('view/options.toggle_hidden');
		});

		const sortSelect = this.node.querySelector('#sort-select') as HTMLSelectElement;
		sortSelect?.addEventListener('change', () =>
		{
			this.currentSort = sortSelect.value;
			this._commands?.execute('view/sort.change', { sort: this.currentSort });
		});

		const groupSelect = this.node.querySelector('#group-select') as HTMLSelectElement;
		groupSelect?.addEventListener('change', () =>
		{
			this.currentGroup = groupSelect.value;
			this._commands?.execute('view/group.change', { group: this.currentGroup });
		});

		const viewButtons = this.node.querySelectorAll('.view-btn');
		viewButtons.forEach(btn =>
		{
			btn.addEventListener('click', () =>
			{
				const viewMode = btn.getAttribute('data-view');
				if(viewMode)
				{
					this._commands?.execute(`view/mode.${viewMode}`);
				}
			});
		});
	}

	public setViewMode(view: string): void
	{
		if(this.activeViews.has(view))
		{
			this.activeViews.delete(view);
		} else
		{
			this.activeViews.add(view);
		}
		this._updateUIState();
	}

	public toggleHiddenFiles(forcedState?: boolean): void
	{
		this.showHiddenFiles = forcedState !== undefined ? forcedState : !this.showHiddenFiles;
		const checkbox = this.node.querySelector('#toggle-hidden-files') as HTMLInputElement;
		if(checkbox) checkbox.checked = this.showHiddenFiles;
	}

	private _updateUIState(): void
	{
		const viewButtons = this.node.querySelectorAll('.view-btn');
		viewButtons.forEach(btn =>
		{
			const viewMode = btn.getAttribute('data-view');
			if(viewMode)
			{
				btn.classList.toggle('active', this.activeViews.has(viewMode));
			}
		});
	}
}

menuSelf.ViewToolbar = ViewToolbar;

// Register Global Modules for View functionality
if(!menuSelf.globalModules)
{
	menuSelf.globalModules = {};
}

menuSelf.globalModules['view/options'] = {
	toggle_hidden: function ()
	{
		const toolbar = ViewToolbar.getInstance();
		toolbar.toggleHiddenFiles();
		const activeWidget = menuSelf.lastInteractedWidget ?? menuSelf.previousInteractedWidget;
		if(typeof (activeWidget as any)?.setShowHidden === 'function')
		{
			(activeWidget as any).setShowHidden(toolbar.showHiddenFiles);
		}
	}
};

const viewModes = ['netflix', 'coverflow', 'grid', 'details', 'tree'];
if(!menuSelf.globalModules['view/mode'])
{
	menuSelf.globalModules['view/mode'] = {};
}

viewModes.forEach(mode =>
{
	menuSelf.globalModules!['view/mode'][mode] = function ()
	{
		const toolbar = ViewToolbar.getInstance();
		toolbar.setViewMode(mode);
		const activeWidget = menuSelf.lastInteractedWidget ?? menuSelf.previousInteractedWidget;
		if(typeof (activeWidget as any)?.setViewMode === 'function')
		{
			(activeWidget as any).setViewMode(mode, toolbar.activeViews.has(mode));
		}
	};
});
