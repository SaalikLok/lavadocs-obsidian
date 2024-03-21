import { App, Notice, Plugin, PluginSettingTab, RequestUrlParam, Setting, TFile, requestUrl } from 'obsidian';

const prodUrl = "https://lavadocs.com";
const devUrl = "http://localhost:3000";

interface LavadocsPluginSettings {
	lavaKey: string;
	openNewWindow: boolean;
}

const DEFAULT_SETTINGS: LavadocsPluginSettings = {
	lavaKey: '',
	openNewWindow: true
}

export default class LavadocsPlugin extends Plugin {
	settings: LavadocsPluginSettings;

	async onload() {
		await this.loadSettings();
		
		const ribbonIconEl = this.addRibbonIcon('mountain', 'Push to Lavadocs', async (evt: MouseEvent) => {
			const { title, content, slug } = await this.getActiveFileDetails();
			
			if (!title || !content || !slug) {
				new Notice("No active file");
				return;
			}
			this.pushToLavadocs(title, content, slug);
		});
		ribbonIconEl.addClass('lavadocs-ribbon-class');

		this.addCommand({
			id: 'push-to-lavadocs',
			name: 'Push',
			checkCallback: (checking: boolean) => {
				(async () => {
					const { title, content, slug } = await this.getActiveFileDetails();

					if (title && content && slug) {
	
						if (!checking) {
							this.pushToLavadocs(title, content, slug);
						}
	
						return true;
					}
					return false;
				})();
			},
		});

		this.addSettingTab(new LavadocsSettings(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async pushToLavadocs(title: string, content: string, slug: string) {
		const requestParams: RequestUrlParam = {
			url: `${devUrl}/api/v1/documents`,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `${this.settings.lavaKey}`
			},
			body: JSON.stringify({
				document : {
					title,
					content,
					slug
				}
			})
		};

		const response = requestUrl(requestParams);

		try {
			const data = await response.json;
			
			new Notice("Pushed to Lavadocs!");

			if (this.settings.openNewWindow) {
				window.open(`${devUrl}/users/${data.username}/documents/${data.slug}`)
			}
		} catch (error) {
			if (error.status === 401) {
				new Notice("Unauthorized, the gates are closed! Check your Lava Key in the settings.");
				return;
			}
	
			new Notice(`Error pushing to Lavadocs: ${error.message}`);
			console.error(error);
			return;
		}
	}

	async getActiveFileDetails() {
		const activeFile = this.app.workspace.getActiveFile();

		const title = activeFile?.basename;
		const content = await this.getActiveFileContent(activeFile);
		const slug = activeFile?.basename.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, "");
		
		if (!title || !content || !slug) {
			new Notice("No active file");
			return { title: null, content: null, slug: null };
		}

		return { title, content, slug };
	}

	async getActiveFileContent(activeFile: TFile | null) {
		if (activeFile) {
			const fileData = await this.app.vault.cachedRead(activeFile);
			return fileData;
		}

		return null;
	}
}

class LavadocsSettings extends PluginSettingTab {
	plugin: LavadocsPlugin;

	constructor(app: App, plugin: LavadocsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Lava Key")
			.setDesc("Get this from your lavadocs.com account settings. Keep it secret, keep it safe!")
			.addText(text => text
				.setPlaceholder('Enter your key')
				.setValue(this.plugin.settings.lavaKey)
				.onChange(async (value) => {
					this.plugin.settings.lavaKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("New window after push")
			.setDesc("Open Lavadocs in a new window after pushing your doc.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.openNewWindow)
				.onChange(async (value) => {
					this.plugin.settings.openNewWindow = value;
					await this.plugin.saveSettings();
				}));
	}
}
