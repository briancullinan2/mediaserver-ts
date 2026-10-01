import { Widget } from '@lumino/widgets';

export class SplashScreenWidget extends Widget
{
	private _statusNode: HTMLDivElement;
	private _progressBarNode: HTMLDivElement;

	constructor(initialStatus: string = 'Initializing service worker...')
	{
		super();
		this.addClass('lm-SplashOverlay');

		// Create background ambient element
		const ambientGlow = document.createElement('div');
		ambientGlow.className = 'lm-SplashOverlay-ambientGlow';

		// Create spinner rings
		const spinnerContainer = document.createElement('div');
		spinnerContainer.className = 'lm-SplashOverlay-spinnerContainer';

		const outerRing = document.createElement('div');
		outerRing.className = 'lm-SplashOverlay-spinnerRing';

		const innerRing = document.createElement('div');
		innerRing.className = 'lm-SplashOverlay-spinnerRingInner';

		spinnerContainer.appendChild(outerRing);
		spinnerContainer.appendChild(innerRing);

		// Title / Status Labels
		const titleNode = document.createElement('div');
		titleNode.className = 'lm-SplashOverlay-title';
		titleNode.textContent = 'Loading Media';

		this._statusNode = document.createElement('div');
		this._statusNode.className = 'lm-SplashOverlay-status';
		this._statusNode.textContent = initialStatus;

		// Create progress bar track & fill
		const trackNode = document.createElement('div');
		trackNode.className = 'lm-SplashOverlay-progressTrack';

		this._progressBarNode = document.createElement('div');
		this._progressBarNode.className = 'lm-SplashOverlay-progressBar';
		trackNode.appendChild(this._progressBarNode);

		// Assemble DOM
		this.node.appendChild(ambientGlow);
		this.node.appendChild(spinnerContainer);
		this.node.appendChild(titleNode);
		this.node.appendChild(this._statusNode);
		this.node.appendChild(trackNode);
	}

	/**
	 * Update the status text dynamically as files load or SW responds.
	 */
	public setStatus(fileOrMessage: string): void
	{
		if(this._statusNode)
		{
			this._statusNode.textContent = fileOrMessage;
		}
	}

	/**
	 * Smoothly fade out and dispose of the widget when ready.
	 */
	public dismiss(durationMs: number = 400): Promise<void>
	{
		return new Promise((resolve) =>
		{
			this.node.style.transition = `opacity ${durationMs}ms ease`;
			this.node.style.opacity = '0';

			setTimeout(() =>
			{
				this.dispose();
				resolve();
			}, durationMs);
		});
	}

	/**
   * Update progress percentage (0 - 100) and optional label.
   */
	public setProgress(percent: number, statusText?: string): void
	{ // <--- 3. ADD METHOD
		const clamped = Math.min(100, Math.max(0, percent));
		if(this._progressBarNode)
		{
			this._progressBarNode.style.width = `${clamped}%`;
		}
		if(statusText)
		{
			this.setStatus(`${statusText} (${Math.round(clamped)}%)`);
		}
	}

}
