import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";
import { MenuConfig, MenuManager } from "./menu-manager";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "./menu.d";
import type { EditorWindow } from "../editor/widget.d";
import type { FileSystemWindow, LuminoLayoutWindow } from "./lumino.d";
import { triggerPanelRoute } from "./menu";

type ExtendedWindow = LuminoMenuWindow & LuminoLayoutWindow
	& GlobalToolbarsWindow & EditorWindow & FileSystemWindow;

const menuSelf: ExtendedWindow = self as unknown as any;

export const EDIT_MENU: MenuConfig = {
	name: "Edit",
	iconClass: "bx bx-edit",
	children: [
		{
			name: "Undo",
			shortcut: "Ctrl+Z",
			target: "edit/undo.undo",
			iconClass: "bx bx-undo"
		},
		{
			name: "Redo",
			shortcut: "Ctrl+Y",
			target: "edit/redo.redo",
			iconClass: "bx bx-redo"
		},
		{ divider: true },
		{
			name: "Cut",
			shortcut: "Ctrl+X",
			target: "edit/cut.cut",
			iconClass: "bx bx-cut"
		},
		{
			name: "Copy to Clipboard",
			shortcut: "Ctrl+C",
			target: "edit/copy.copy_to_clipboard",
			iconClass: "bx bx-copy"
		},
		{
			name: "Paste",
			shortcut: "Ctrl+V",
			target: "edit/paste.paste",
			iconClass: "bx bx-paste"
		},
		{
			name: "Rename",
			shortcut: "F2",
			target: "edit/rename.rename",
			iconClass: "bx bx-edit"
		},
		{
			name: "Delete Selection",
			target: "edit/selection.delete",
			iconClass: "bx bx-trash"
		},
		{ divider: true },
		{
			name: "Find",
			shortcut: "Ctrl+F",
			target: "edit/find.find",
			iconClass: "bx bx-search"
		},
		{
			name: "Find In Files",
			shortcut: "Ctrl+Shift+F",
			target: "edit/find.find_all",
			iconClass: "bx bx-folder-search"
		},
		{
			name: "Replace",
			shortcut: "Ctrl+H",
			target: "edit/replace.replace",
			iconClass: "bx bx-rename"
		},
		{
			name: "Search Images",
			ellipsis: true,
			target: "file/open.search",
			iconClass: "bx bx-search-alt"
		},
		{ divider: true },
		{
			name: "Select All",
			shortcut: "Ctrl+A",
			target: "edit/selection.select_all",
			iconClass: "bx bx-select-all"
		},
		{
			name: "Deselect All",
			shortcut: "~",
			target: "edit/deselect_all",
			iconClass: "bx bx-select-none"
		}
	]
};

export class EditToolbar extends Widget
{
	private static _instance: EditToolbar | null = null;
	private _commands: CommandRegistry | null = null;

	private constructor()
	{
		super();
		this.id = 'edit-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): EditToolbar
	{
		if(!EditToolbar._instance)
		{
			EditToolbar._instance = new EditToolbar();
			menuSelf.editToolbar = EditToolbar._instance;
		}
		return EditToolbar._instance;
	}

	public initialize(commands: CommandRegistry): EditToolbar
	{
		this._commands = commands;
		menuSelf.registerAllCommands?.(EDIT_MENU);
		MenuManager.injectMenus(null, EDIT_MENU);
		return this;
	}

	private _buildInterface(): void
	{
		this.node.innerHTML = `
            <button class="bx bx-cut" id="btn-cut" title="Cut"></button>
            <button class="bx bx-copy" id="btn-copy" title="Copy"></button>
            <button class="bx bx-paste" id="btn-paste" title="Paste"></button>
            <button class="bx bx-edit" id="btn-rename" title="Rename"></button>
            <button class="bx bx-trash" id="btn-delete" title="Delete"></button>
        `;

		this.node.querySelector('#btn-cut')?.addEventListener('click', () =>
		{
			this._commands?.execute('edit/cut.cut');
		});

		this.node.querySelector('#btn-copy')?.addEventListener('click', () =>
		{
			this._commands?.execute('edit/copy.copy_to_clipboard');
		});

		this.node.querySelector('#btn-paste')?.addEventListener('click', () =>
		{
			this._commands?.execute('edit/paste.paste');
		});

		this.node.querySelector('#btn-rename')?.addEventListener('click', () =>
		{
			this._commands?.execute('edit/rename.rename');
		});

		this.node.querySelector('#btn-delete')?.addEventListener('click', () =>
		{
			this._commands?.execute('edit/selection.delete');
		});
	}
}

menuSelf.EditToolbar = EditToolbar;

// Register Global Modules for Edit functionality
if(!menuSelf.globalModules)
{
	menuSelf.globalModules = {};
}

menuSelf.globalModules['edit/rename'] = {
	rename: function ()
	{
		const activeWidget = menuSelf.lastInteractedWidget ?? menuSelf.previousInteractedWidget;
		if(!activeWidget) return;

		// Dispatch rename handler across active editor instance implementations
		if(typeof (activeWidget as any).rename === 'function')
		{
			(activeWidget as any).rename();
		} else if(activeWidget.title)
		{
			const currentName = activeWidget.title.label || '';
			const newName = prompt('Enter new file name:', currentName);
			if(newName && newName !== currentName)
			{
				activeWidget.title.label = newName;
			}
		}
	}
};


menuSelf.globalModules['edit/find'] = {
	find_all: async function ()
	{
		if(menuSelf.mainDock)
		{
			await triggerPanelRoute('searchlist', menuSelf.mainDock, true);
		}
	}
};
