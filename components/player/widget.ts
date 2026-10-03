import { BoxPanel, DockPanel, SplitPanel, Widget } from "@lumino/widgets";
import { MediaViewportWidget } from "./widget-viewport";
import { TransportBarWidget } from "./controls";
import { PLAYLIST_DATA, PlaylistPanelWidget } from "./platlist";
import { XRayPanelWidget } from "./xray";
import { Message } from "@lumino/messaging";

export type TransporterCommand = 'next' | 'ff' | 'rw' | 'prev' | 'setCrossfade' | 'toggleLayout' | 'togglePlay';
export type TransporterCallback = (cmd: TransporterCommand, state?: any) => void;
export type TrackCallback = (track: string | PlaylistEntry) => void;

export interface PlaylistEntry
{
	id: string;
	type: 'youtube' | 'audio' | 'video' | 'photo';
	title: string;
	artist?: string;
	src?: string;
	thumb?: string;
	duration?: number;
	xray?: {
		scene: string,
		cast: string[],
		trivia: string;
	};
	photos?: string[];
}


export class PlayerWidget extends Widget
{
	currentTrackIndex: number;
	crossfadeTime: number;
	isCarouselHorizontal: boolean;
	mainSplitPanel: any;
	mediaViewport?: MediaViewportWidget;
	transportBar?: TransportBarWidget;
	rightDockPanel: any;
	playlistPanel?: PlaylistPanelWidget;
	xrayPanel?: XRayPanelWidget;
	constructor()
	{
		super();
		this.currentTrackIndex = 0;
		this.crossfadeTime = 3;
		this.isCarouselHorizontal = false;

	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.initUI();
		this.loadTrack(PLAYLIST_DATA[0]);
	}

	initUI()
	{
		// 1. App Header
		const header = document.createElement('header');
		this.title.label = 'Player';
		header.className = 'app-header';
		header.innerHTML = `
                        <div class="app-title">
                            <i class="fa-solid fa-compact-disc"></i> Lumino Media Suite
                        </div>
                        <div class="header-actions">
                            <button class="btn-glass active"><i class="fa-solid fa-layer-group"></i> Dock Layout</button>
                        </div>
                    `;
		this.node.appendChild(header);

		// 2. Lumino SplitPanel Container
		this.mainSplitPanel = new SplitPanel({ orientation: 'horizontal' });
		this.mainSplitPanel.id = 'lumino-main-split';

		// Center Media Viewport Box
		this.mediaViewport = new MediaViewportWidget();

		// Transport Control Bar
		this.transportBar = new TransportBarWidget((cmd, val) => this.handleTransportCommand(cmd, val));

		// Assemble Center Stack
		const centerBox = new BoxPanel({ direction: 'top-to-bottom' });
		BoxPanel.setStretch(this.mediaViewport, 1);
		BoxPanel.setStretch(this.transportBar, 0);
		centerBox.addWidget(this.mediaViewport);
		centerBox.addWidget(this.transportBar);

		// Sidebar DockPanel (Right Panel for Up Next + X-Ray Tabs)
		this.rightDockPanel = new DockPanel();
		this.playlistPanel = new PlaylistPanelWidget((track: PlaylistEntry | string) => this.loadTrack(track));
		this.xrayPanel = new XRayPanelWidget();

		this.rightDockPanel.addWidget(this.playlistPanel);
		this.rightDockPanel.addWidget(this.xrayPanel, { mode: 'tab-after', ref: this.playlistPanel });

		// Add to Main Split
		this.mainSplitPanel.addWidget(centerBox);
		this.mainSplitPanel.addWidget(this.rightDockPanel);
		this.mainSplitPanel.setRelativeSizes([0.72, 0.28]);

		// Attach to DOM
		Widget.attach(this.mainSplitPanel, this.node);
	}

	loadTrack(track: PlaylistEntry | string)
	{
		if(typeof track === 'object')
		{
			this.currentTrackIndex = PLAYLIST_DATA.findIndex(t => t.id === track.id);
			this.mediaViewport?.switchTrack(track);
			this.playlistPanel?.renderTracks(track.id);
			this.xrayPanel?.updateMetadata(track);
		}
	}

	handleTransportCommand(command: TransporterCommand, value: any)
	{
		if(command === 'next')
		{
			const nextIdx = (this.currentTrackIndex + 1) % PLAYLIST_DATA.length;
			this.loadTrack(PLAYLIST_DATA[nextIdx]);
		} else if(command === 'prev')
		{
			const prevIdx = (this.currentTrackIndex - 1 + PLAYLIST_DATA.length) % PLAYLIST_DATA.length;
			this.loadTrack(PLAYLIST_DATA[prevIdx]);
		} else if(command === 'setCrossfade')
		{
			this.crossfadeTime = parseInt(value, 10);
		} else if(command === 'toggleLayout')
		{
			this.toggleCarouselLayout();
		}
	}

	toggleCarouselLayout()
	{
		this.isCarouselHorizontal = !this.isCarouselHorizontal;
		if(this.isCarouselHorizontal)
		{
			this.playlistPanel?.addClass('carousel-horizontal');
		} else
		{
			this.playlistPanel?.removeClass('carousel-horizontal');
		}
	}
}
