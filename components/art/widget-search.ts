import { Widget } from "@lumino/widgets";

export interface ISearchable
{
	node: HTMLElement;
	searchContainer?: HTMLDivElement;
	searchInput?: HTMLInputElement;
	searchObserver?: ResizeObserver;
	parentTabBar?: HTMLElement;
	id?: string;
	executeFindQuery?(pooledCtx: any, event?: KeyboardEvent | null): void;
}

export interface ITabButton
{
	id?: string;
	node: HTMLElement;
	parent?: Widget | null;
	_toggleBtn?: HTMLElement | HTMLDivElement;
}



// TODO: replace terminal search attachment with this widget
export class WidgetSearchBar
{
	static readonly resizeListeners: EventListener[] = [];
	static readonly seenContexts: ISearchable[] = [];

	private static createSearchElement(context: ISearchable): void
	{
		if(!context || context.searchContainer)
		{
			return;
		}
		context.searchContainer = document.createElement('div');
		context.searchContainer.className = 'lumino-tab-search-wrapper';
		// Start hidden until onAfterShow fires
		context.searchContainer.style.display = 'none';

		context.searchInput = document.createElement('input');
		context.searchInput.type = 'search';
		context.searchInput.id = 'search-widget';
		context.searchInput.placeholder = 'Search...';
		context.searchInput.autocomplete = 'off';

		context.searchInput.addEventListener('keypress', event =>
		{
			if(event.key === 'Enter')
			{
				event.preventDefault();
			}

			if(!context)
			{
				return;
			}

			context.executeFindQuery?.(context, event);
		});
		context.searchContainer.appendChild(context.searchInput);
		context.searchObserver = new ResizeObserver((entries) =>
		{
			//for(const entry of entries)
			//{
			//const { width, height } = entry.contentRect;
			//}
			WidgetSearchBar.resizeSearchContainer(context);
		});
		context.searchObserver.observe(context.node);
	}


	/**
	 * Triggered by Lumino lifecycle manager when the tab layout brings this item into view.
	 */
	public static onAfterShow(that: ISearchable): void
	{
		WidgetSearchBar.createSearchElement(that);
		window.requestAnimationFrame(() =>
		{
			WidgetSearchBar.showSearchBar(that);
		});
	}

	private static resizeSearchContainer = (context: ISearchable) =>
	{
		const parentTabBar = context.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`.lm-TabBar:has(li.${context.id})`) as HTMLElement;

		if(!parentTabBar || !context
			|| !context.searchContainer
			|| context.searchContainer.style.display === 'none')
		{
			return;
		}


		if(typeof context === 'object')
		{
			context.parentTabBar = parentTabBar;
		}


		if('parentTabBar' in context)
		{
			if(parentTabBar !== context.parentTabBar)
			{
				parentTabBar.appendChild(context.searchContainer);
			}
		} else
		{
			parentTabBar?.appendChild(context.searchContainer);
		}

		// Ensure searchContainer doesn't push the tab bar layout around
		context.searchContainer.style.position = 'absolute';
		context.searchContainer.style.right = '0px';

		const totalWidth = parentTabBar.getBoundingClientRect().width;
		let occupiedWidth = 0;

		// Target the actual tab items (typically 'li' elements with the class '.lm-TabBar-tab')
		// instead of the full-width wrapper panels.
		const actualTabs = parentTabBar.querySelectorAll('.lm-TabBar-content li');

		actualTabs.forEach((tab) =>
		{
			const element = tab as HTMLElement;
			const rect = element.getBoundingClientRect();

			const style = window.getComputedStyle(element);
			const margins = parseFloat(style.marginLeft || '0') + parseFloat(style.marginRight || '0');
			const elementTotalWidth = rect.width + margins;

			// If adding this element exceeds the available row width, it wraps to a new row.
			// We reset the row's occupied width tracking back to 0 before adding this element.
			if(occupiedWidth + elementTotalWidth > totalWidth && occupiedWidth > 0)
			{
				occupiedWidth = 0;
			}

			occupiedWidth += elementTotalWidth;
		});

		// Handle any extra functional sibling controls (like scroll buttons if present)
		const extraControls = parentTabBar.querySelectorAll('.lm-TabBar-scrollButton');
		extraControls.forEach((control) =>
		{
			const element = control as HTMLElement;
			const rect = element.getBoundingClientRect();
			const elementTotalWidth = rect.width;

			if(occupiedWidth + elementTotalWidth > totalWidth && occupiedWidth > 0)
			{
				occupiedWidth = 0;
			}

			occupiedWidth += elementTotalWidth;
		});

		// Set max-width based on the remaining space on the final row line
		const remainingSpace = Math.max(0, totalWidth - occupiedWidth - 15);
		context.searchContainer.style.maxWidth = `${remainingSpace}px`;
	};

	private static showSearchBar(context: ISearchable)
	{
		context.parentTabBar = context.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`.lm-TabBar:has(li.${context.id})`) as HTMLElement;

		if(context.parentTabBar && context && context.searchContainer)
		{
			context.parentTabBar.appendChild(context.searchContainer);
			context.searchContainer.style.display = 'flex';

			// Calculate initial width
			window.requestAnimationFrame(() =>
			{
				WidgetSearchBar.resizeSearchContainer(context);
			});

			// Listen for window resizing to keep the width updated
			let contextId = WidgetSearchBar.seenContexts.indexOf(context);
			if(contextId > -1)
			{
				window.removeEventListener('resize', WidgetSearchBar.resizeListeners[contextId]);
				WidgetSearchBar.seenContexts.splice(contextId, 1);
				WidgetSearchBar.resizeListeners.splice(contextId, 1);
			} else
			{
				contextId = WidgetSearchBar.resizeListeners.length;
			}
			WidgetSearchBar.seenContexts[contextId] = context;
			WidgetSearchBar.resizeListeners[contextId] = WidgetSearchBar.resizeSearchContainer.bind(context, context);
			window.addEventListener('resize', WidgetSearchBar.resizeListeners[contextId]);
			context.searchObserver?.observe(context.node);
		}
	}

	/**
	 * Triggered by Lumino lifecycle manager when the tab loses active focus or is moved.
	 */
	public static onAfterHide(context: ISearchable): void
	{
		if(context && context.searchContainer)
		{
			if(context.searchContainer.parentNode)
			{
				context.searchContainer.parentNode.removeChild(context.searchContainer);
			}
			context.searchContainer.style.display = 'none';
			let contextId = WidgetSearchBar.seenContexts.indexOf(context);
			if(contextId > -1)
			{
				window.removeEventListener('resize', WidgetSearchBar.resizeListeners[contextId]);
				WidgetSearchBar.seenContexts.splice(contextId, 1);
				WidgetSearchBar.resizeListeners.splice(contextId, 1);
			}
			context.searchObserver?.unobserve(context.node);
		}
	}

	public static onAfterAttach(context: ISearchable): void
	{

		WidgetSearchBar.createSearchElement(context);
		window.requestAnimationFrame(() =>
		{
			WidgetSearchBar.showSearchBar(context);
		});
	}

	public static onBeforeDetach(context: ISearchable): void
	{
		if(context && context.searchContainer
			&& context.searchContainer.parentNode)
		{
			context.searchContainer.parentNode.removeChild(context.searchContainer);
		}
		context?.searchObserver?.disconnect();
	}



	public static attachToggleIcon(context: ITabButton, renderToggle?: (toggle: HTMLElement) => void, click?: (event: PointerEvent | Event) => void): void
	{
		// Locate the DOM node for the specific tab item
		let tabNode: HTMLElement | undefined | null;
		if(context.id)
		{
			tabNode = context.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`.lm-TabBar:has(li.${context.id})`) as HTMLElement;
		}
		if(!tabNode && context.node.parentElement?.id)
		{
			tabNode = context.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`.lm-TabBar:has(li.${context.node.parentElement.id})`) as HTMLElement;
		}
		if(!tabNode && context.node.parentElement?.parentElement?.id)
		{
			tabNode = context.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`.lm-TabBar:has(li.${context.node.parentElement.parentElement.id})`) as HTMLElement;
		}
		if(!tabNode && context.parent?.id)
		{
			tabNode = context.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`.lm-TabBar:has(li.${context.parent.id})`) as HTMLElement;
		}
		if(!tabNode)
		{
			const parentWidgetId = (context.parent?.node ?? context.node.parentElement?.closest('.lm-Widget'))?.id;
			if(parentWidgetId)
			{
				tabNode = context.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`.lm-TabBar:has(li.${parentWidgetId})`) as HTMLElement;
			}
		}

		if(!tabNode) return;

		// Find Lumino's native close icon container
		const closeIconNode = tabNode.querySelector('.lm-TabBar-tabCloseIcon');
		if(!closeIconNode || tabNode.querySelector('.custom-toggle-btn')) return;

		// Create custom toggle button
		context._toggleBtn = document.createElement('div');
		context._toggleBtn.className = 'lm-TabBar-tabIcon custom-toggle-btn';
		renderToggle?.apply(context, [context._toggleBtn]);
		context._toggleBtn.addEventListener('click', (event) =>
		{
			// TODO: toggle netflix view
			event.stopPropagation(); // Stop event bubbling to tab selection
			click?.apply(context, [event]);
			if(context._toggleBtn)
			{
				renderToggle?.apply(context, [context._toggleBtn]);
			}
		});

		// Insert toggle right before the close icon
		closeIconNode.parentNode?.insertBefore(context._toggleBtn, closeIconNode);
	}

}
