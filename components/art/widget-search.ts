
export interface ISearchable
{
	searchContainer: HTMLDivElement;
	searchInput: HTMLInputElement;
	node: HTMLElement;
	searchObserver: ResizeObserver;
	parentTabBar?: HTMLElement;
	id?: string;
	executeFindQuery?(pooledCtx: any, event?: KeyboardEvent | null): void;
}

export class WidgetSearchBar
{

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
		context.searchInput.id = 'search-terminal';
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
			this.resizeSearchContainer(context);
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

		//console.log('search bar: ', parentTabBar, this.searchContainer, this.searchContainer.style.display);

		if(!parentTabBar || !context
			|| !context.searchContainer
			|| context.searchContainer.style.display === 'none')
		{
			return;
		}


		if(typeof context === 'object')
		{
			(context as any).parentTabBar = parentTabBar;
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
			window.removeEventListener('resize', WidgetSearchBar.resizeSearchContainer.bind(context, context));
			window.addEventListener('resize', WidgetSearchBar.resizeSearchContainer.bind(context, context));
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
			window.removeEventListener('resize', WidgetSearchBar.resizeSearchContainer.bind(context, context));
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

}
