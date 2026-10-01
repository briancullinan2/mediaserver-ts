// ServiceWorkerManager.ts


import { getGitShaBrowser, getDefaultBranch, getBranchVersion } from "./github";
import { IMPORT_SETTINGS } from "./github-settings";
import { FS } from "./global";
import
{
	DB_SCHEME, DB_STORE_NAME, deleteOldDatabase
	, FS_FILE, getDatabaseMetadata, needsInstall
	, putRecord, setupDatabase
} from "./local";
import { FileRecord } from './local.d';
import type { FileSystemWindow, LuminoLayoutWindow } from "./lumino.d";
import { SettingsManager } from "./settings";

const workerSelf: FileSystemWindow & LuminoLayoutWindow = self as unknown as any;

export class ServiceWorkerManager
{
	private readonly defaultOwner = 'briancullinan2';
	private readonly defaultRepo = 'mediaserver-ts';
	private readonly defaultBranch = 'main';
	private readonly settingsFilePath = '/base/settings.json';

	/**
	 * Main orchestrator entry point
	 */
	public async initialize(): Promise<void>
	{
		if(!('serviceWorker' in navigator)) return;

		const serverVersion = await this.fetchServerVersion();
		await this.syncWorkerSettings();

		const registration = await this.registerNewWorker();

		if(registration?.active && !navigator.serviceWorker.controller)
		{
			const controlledPromise = new Promise<void>((resolve) =>
			{
				const onChange = () =>
				{
					if(navigator.serviceWorker.controller)
					{
						navigator.serviceWorker.removeEventListener('controllerchange', onChange);
						resolve();
					}
				};
				navigator.serviceWorker.addEventListener('controllerchange', onChange);
			});

			// Ask the active SW to take control via postMessage
			workerSelf.splashScreen?.setStatus('Reclaiming Service');
			registration.active.postMessage({ type: 'CLAIM_CLIENTS' });

			await controlledPromise;
		}


		if(registration?.active)
		{
			await this.verifyAndReconcileVersion(registration, serverVersion);
		}

	}

	/**
	 * Step 1: Fetches the latest build timestamp token from the server
	 */
	private async fetchServerVersion(): Promise<Date | null>
	{
		try
		{
			return await getBranchVersion(this.defaultOwner, this.defaultRepo, this.defaultBranch);
		} catch(e)
		{
			console.warn("Could not reach server for version check. Proceeding with caution.");
			return null;
		}
	}

	/**
	 * Step 2: Coordinates the complete configuration storage environment layout pipeline
	 */
	private async syncWorkerSettings(): Promise<void>
	{
		const database = SettingsManager.get('github', 'environmentRepository');
		const [ownerName, repoName] = database.split('/');

		await this.updateEnvironmentVersionSetting(ownerName, repoName);
		await ServiceWorkerManager.ensureDatabaseContainer(database);
		await this.writeVirtualAssetSettings(database);
	}

	/**
	 * Micro-function: Looks up repository configuration details and applies them to SettingsManager
	 */
	private async updateEnvironmentVersionSetting(owner: string, repo: string): Promise<void>
	{
		try
		{
			const branch = await getDefaultBranch(owner, repo);
			const latestFileTime = await getBranchVersion(owner, repo, branch);
			SettingsManager.applyValue(IMPORT_SETTINGS.github.environmentVersion, latestFileTime);
		} catch(e)
		{
			console.error(e);
		}
	}

	/**
	 * Micro-function: Handles structural creation, validation, and layout installation for IndexDB profiles
	 */
	public static async ensureDatabaseContainer(database: string): Promise<void>
	{
		const databases = await getDatabaseMetadata();
		const shouldInstall = (await needsInstall(database, DB_SCHEME)).item3;
		const missing = databases.filter((d: any) => d.key === database).length === 0;

		if(missing || shouldInstall)
		{
			await deleteOldDatabase(database);
			await setupDatabase(database, DB_SCHEME);
		}
	}

	/**
	 * Micro-function: Generates virtual asset structures and saves data arrays down into the storage provider
	 */
	private async writeVirtualAssetSettings(database: string): Promise<void>
	{
		const content = JSON.stringify(SettingsManager.exportPayload(), null, 4);
		const newSha = await getGitShaBrowser(content);
		const virtualPath = database + '/' + this.settingsFilePath;

		FS.virtual[virtualPath] = {
			timestamp: new Date(),
			mode: FS_FILE,
			contents: new TextEncoder().encode(content),
			path: this.settingsFilePath,
			sha: newSha,
			parent: ''
		};

		await putRecord(DB_STORE_NAME, FS.virtual[virtualPath] as FileRecord, database);
	}

	/**
	 * Step 3: Compares operational lifetimes between contexts and triggers tear downs on mismatches
	 */
	private async verifyAndReconcileVersion(registration: ServiceWorkerRegistration, serverVersion: Date | null): Promise<void>
	{
		if(!serverVersion || !registration.active) return;

		workerSelf.splashScreen?.setStatus('Verifying Service');
		const swVersion = await this.queryWorkerValue(registration.active, 'GET_VERSION', 'VERSION_REPORT', 'version');

		if(swVersion && new Date(serverVersion).getTime() !== new Date(swVersion).getTime())
		{
			console.warn(`Version Mismatch! Server: ${serverVersion}, SW: ${swVersion}. Unregistering...`);
			await this.queryWorkerValue(registration.active, 'DEREGISTER', 'DEREGISTERED');
			workerSelf.splashScreen?.setStatus('Service Stale');
		} else
		{
			console.warn('Skipping Service-Worker because: ' + serverVersion + ' reg: ' + registration + ' active: ' + registration?.active);
		}
	}

	/**
	 * Micro-function: Generic async postMessage / MessageChannel polling router interface
	 */
	private queryWorkerValue(worker: ServiceWorker, msgType: string, expectedAckType: string, dataKey?: string): Promise<any>
	{
		return new Promise((resolve) =>
		{
			let percent = 0;
			let resolved = false;
			const messageChannel = new MessageChannel();

			messageChannel.port2.onmessage =
				messageChannel.port1.onmessage = async (event) =>
				{
					if(event.data?.type === expectedAckType)
					{
						resolved = true;
						clearInterval(pollInterval);

						if(dataKey && event.data[dataKey])
						{
							try { resolve(new Date(event.data[dataKey])); } catch { resolve(null); }
						} else
						{
							if(percent === 100)
							{
								resolve(true);
							}
						}
					}

					if(event.data?.type === 'PROGRESS')
					{
						percent = event.data.percent;
						if(event.data?.percent === 100)
						{
							workerSelf.splashScreen?.setProgress(100, 'Service Ready!');
						} else
						{
							workerSelf.splashScreen?.setProgress(event.data.percent, `Fetching ${event.data.previous}...`);
						}
					}
				};

			worker.postMessage({ type: msgType, shutup: true }, [messageChannel.port2]);

			const startTime = Date.now();
			const pollInterval = setInterval(() =>
			{
				if(resolved) return;

				if(Date.now() - startTime > 10000)
				{
					clearInterval(pollInterval);
					console.warn(`SW transaction timeout reached for command: [${msgType}]`);
					resolve(null);
				}
			}, 100);
		});
	}

	/**
	 * Step 4: Registers a fresh Service Worker script file stream
	 */
	private async registerNewWorker(): Promise<ServiceWorkerRegistration | undefined>
	{
		workerSelf.splashScreen?.setStatus('Registering Service');
		const swUrl = `/service-worker.js?t=${Date.now()}`;
		try
		{
			const reg = await navigator.serviceWorker.register(swUrl);
			console.info('Service Worker registered successfully:', reg.scope);
		} catch(err)
		{
			console.error('Service Worker registration failed:', err);
		}
		const registration = await navigator.serviceWorker.getRegistration();

		if(registration)
		{
			await navigator.serviceWorker.ready;
		}

		return registration;
	}
}

workerSelf.ensureDatabaseContainer = ServiceWorkerManager.ensureDatabaseContainer;
