import { Widget } from '@lumino/widgets';
import type { ComponentRoute, TOOLS_REGISTRY } from '../bundle/menu';
import type { RepositorySettingsWindow } from '../bundle/menu.d';


const widgetSelf: RepositorySettingsWindow = self as unknown as any;


export interface ToolsDetailsWidgetOptions
{
	registry?: Record<string, ComponentRoute>;
	onSelectTool?: (key: string, route: ComponentRoute) => void;
}

export class ToolsWidget extends Widget
{
	private _registry?: Record<string, ComponentRoute>;
	private _selectedKey: string | null = null;
	private _onSelectTool?: (key: string, route: ComponentRoute) => void;

	private _searchQuery: string = '';
	private _sidebarContainer!: HTMLDivElement;
	private _detailsContainer!: HTMLElement;
	private _searchInput!: HTMLInputElement;
	private _modulesContainer!: HTMLDivElement;

	constructor(title?: string, options: ToolsDetailsWidgetOptions = {})
	{
		super();
		this.addClass('lm-ToolsDetailsWidget');
		this.title.label = title ?? 'Tools';
		this.title.iconClass = 'bx bx-category-alt';
		this.title.closable = true;

		this._registry = options.registry ?? widgetSelf.TOOLS_REGISTRY;
		this._onSelectTool = options.onSelectTool;

		this._buildUI();
		if(this._registry)
		{
			const firstKey = Object.keys(this._registry)[0];
			if(firstKey)
			{
				this.selectTool(firstKey);
			}
		}
	}

	/**
	 * Programmatically select a tool by its key.
	 */
	public selectTool(key: string): void
	{
		if(!this._registry?.[key] && !widgetSelf.MODULE_REGISTRY?.[key]) return;
		this._selectedKey = key;
		this._renderSidebar();
		this._renderDetails();

		if(this._onSelectTool)
		{
			this._onSelectTool(key, this._registry?.[key] ?? widgetSelf.MODULE_REGISTRY?.[key]);
		}
	}

	/**
	 * Dynamically update or replace the tool registry.
	 */
	public updateRegistry(newRegistry: Record<string, ComponentRoute>): void
	{
		this._registry = newRegistry;
		this._renderSidebar();
		if(this._selectedKey && this._registry[this._selectedKey])
		{
			this._renderDetails();
		} else
		{
			const firstKey = Object.keys(this._registry)[0];
			if(firstKey) this.selectTool(firstKey);
		}
	}

	protected onAfterAttach(): void
	{
		this._renderSidebar();
		if(this._selectedKey)
		{
			this._renderDetails();
		}
	}

	private _buildUI(): void
	{
		this.node.innerHTML = '';

		// Master container
		const layoutWrapper = document.createElement('div');
		layoutWrapper.className = 'tools-details-layout';

		// Sidebar panel
		const sidebar = document.createElement('aside');
		sidebar.className = 'tools-sidebar';

		const sidebarHeader = document.createElement('div');
		sidebarHeader.className = 'tools-sidebar-header';
		sidebarHeader.innerHTML = `<h3><i class="bx bx-spanner"></i> Tool Set</h3>`;

		const searchBox = document.createElement('div');
		searchBox.className = 'tools-search-box';

		this._searchInput = document.createElement('input');
		this._searchInput.type = 'text';
		this._searchInput.placeholder = 'Filter tools...';
		this._searchInput.addEventListener('input', (e) =>
		{
			this._searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this._renderSidebar();
		});

		searchBox.appendChild(this._searchInput);

		this._sidebarContainer = document.createElement('div');
		this._sidebarContainer.className = 'tools-list';

		sidebar.appendChild(sidebarHeader);
		sidebar.appendChild(searchBox);
		sidebar.appendChild(this._sidebarContainer);

		// Main Details panel
		this._detailsContainer = document.createElement('main') as HTMLElement;
		this._detailsContainer.className = 'tools-details-view';

		layoutWrapper.appendChild(sidebar);
		layoutWrapper.appendChild(this._detailsContainer);

		this.node.appendChild(layoutWrapper);
		this._buildModules(sidebar);
	}


	private _buildModules(sidebar: HTMLElement): void
	{

		const sidebarHeader = document.createElement('div');
		sidebarHeader.className = 'tools-sidebar-header';
		sidebarHeader.innerHTML = `<h3><i class="bx bx-cog"></i> Modules</h3>`;

		sidebar.appendChild(sidebarHeader);
		// sidebar.appendChild(searchBox);

		this._modulesContainer = document.createElement('div');
		this._modulesContainer.className = 'tools-list';
		sidebar.appendChild(this._modulesContainer);

	}


	private _renderSidebar(): void
	{
		if(!this._sidebarContainer || !this._registry) return;
		this._sidebarContainer.innerHTML = '';

		const entries = Object.entries(this._registry).filter(([key, route]) =>
		{
			if(!this._searchQuery) return true;
			return (
				route.label.toLowerCase().includes(this._searchQuery) ||
				key.toLowerCase().includes(this._searchQuery) ||
				(route.description && route.description.toLowerCase().includes(this._searchQuery))
			);
		});

		if(entries.length === 0)
		{
			const emptyMsg = document.createElement('div');
			emptyMsg.className = 'tools-empty-state';
			emptyMsg.textContent = 'No matching tools found';
			this._sidebarContainer.appendChild(emptyMsg);
			return;
		}

		entries.forEach(([key, route]) =>
		{
			const item = document.createElement('div');
			item.className = `tools-item ${key === this._selectedKey ? 'active' : ''}`;
			item.onclick = () => this.selectTool(key);

			item.innerHTML = `
        <div class="tools-item-icon"><i class="${route.iconClass}"></i></div>
        <div class="tools-item-meta">
          <span class="tools-item-title">${this._escapeHTML(route.label)}</span>
          <span class="tools-item-key">${this._escapeHTML(key)}</span>
        </div>
      `;

			this._sidebarContainer.appendChild(item);
		});

		this._renderModules();

	}

	private _renderModules(): void
	{
		if(!this._modulesContainer || !widgetSelf.MODULE_REGISTRY) return;
		this._modulesContainer.innerHTML = '';

		const entries = Object.entries(widgetSelf.MODULE_REGISTRY).filter(([key, route]) =>
		{
			if(!route.url) return false;
			if(!this._searchQuery) return true;
			return (
				route.label.toLowerCase().includes(this._searchQuery) ||
				key.toLowerCase().includes(this._searchQuery) ||
				(route.description && route.description.toLowerCase().includes(this._searchQuery))
			);
		});

		if(entries.length === 0)
		{
			const emptyMsg = document.createElement('div');
			emptyMsg.className = 'tools-empty-state';
			emptyMsg.textContent = 'No matching tools found';
			this._modulesContainer.appendChild(emptyMsg);
			return;
		}

		entries.forEach(([key, route]) =>
		{
			const item = document.createElement('div');
			item.className = `tools-item ${key === this._selectedKey ? 'active' : ''}`;
			item.onclick = () => this.selectTool(key);

			item.innerHTML = `
        <div class="tools-item-icon"><i class="${route.iconClass}"></i></div>
        <div class="tools-item-meta">
          <span class="tools-item-title">${this._escapeHTML(route.label)}</span>
          <span class="tools-item-key">${this._escapeHTML(key)}</span>
        </div>
      `;

			this._modulesContainer.appendChild(item);
		});
	}

	private _renderDetails(): void
	{
		if(!this._detailsContainer || !this._registry) return;
		this._detailsContainer.innerHTML = '';

		if(!this._selectedKey || (!this._registry[this._selectedKey] && !widgetSelf.MODULE_REGISTRY?.[this._selectedKey]))
		{
			this._detailsContainer.innerHTML = `
        <div class="tools-placeholder">
          <i class="bx bx-select-multiple"></i>
          <p>Select a tool from the list to view its configuration and operational details.</p>
        </div>
      `;
			return;
		}

		const route = this._registry?.[this._selectedKey] ?? widgetSelf.MODULE_REGISTRY?.[this._selectedKey];

		const card = document.createElement('div');
		card.className = 'tools-card';

		card.innerHTML = `
      <header class="tools-card-header">
        <div class="tools-card-badge">
          <i class="${route.iconClass}"></i>
        </div>
        <div class="tools-card-title-group">
          <h2>${this._escapeHTML(route.label)}</h2>
          <code class="tools-key-tag">${this._escapeHTML(this._selectedKey)}</code>
        </div>
      </header>

      <section class="tools-card-section">
        <h4><i class="bx bx-text"></i> Overview & Capability</h4>
        <p class="tools-description-text">${this._escapeHTML(route.description || 'No detailed description provided.')}</p>
      </section>

      <section class="tools-card-section">
        <h4><i class="bx bx-code-block"></i> Dependencies & System Requirements</h4>
        <div class="tools-subtext-box">
          <i class="bx bx-info-circle"></i>
          <span>${this._escapeHTML(route.subtext || 'No dependency notes recorded.')}</span>
        </div>
      </section>

      <section class="tools-card-section">
        <h4><i class="bx bx-slider-alt"></i> Routing Metadata</h4>
        <div class="tools-meta-grid">
          <div class="meta-row">
            <span class="meta-label">Module Target:</span>
            <code class="meta-value">${route.url ? this._escapeHTML(route.url) : ''}</code>
          </div>
          <div class="meta-row">
            <span class="meta-label">Class Identifier:</span>
            <code class="meta-value">${route.className ? this._escapeHTML(route.className) : ''}</code>
          </div>
          <div class="meta-row">
            <span class="meta-label">Icon Specifier:</span>
            <code class="meta-value">${this._escapeHTML(route.iconClass)}</code>
          </div>
        </div>
      </section>

      <footer class="tools-card-actions">
        <button class="tools-action-btn primary" id="btn-launch-tool">
          <i class="bx bx-play-circle"></i> Initialize ${route.className ? this._escapeHTML(route.className) : ''}
        </button>
      </footer>
    `;

		this._detailsContainer.appendChild(card);

		const launchBtn = card.querySelector('#btn-launch-tool');
		if(launchBtn)
		{
			launchBtn.addEventListener('click', () =>
			{
				if(this._onSelectTool && this._selectedKey)
				{
					this._onSelectTool(this._selectedKey, route);
				}
			});
		}
	}

	private _escapeHTML(str: string): string
	{
		return str.replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}
