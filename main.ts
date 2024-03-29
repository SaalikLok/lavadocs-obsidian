import { get } from 'http';
import { App, Notice, Plugin, PluginSettingTab, RequestUrlParam, Setting, requestUrl } from 'obsidian';

interface LavadocsPluginSettings {
	lavaKey: string;
	url: string;
	openNewWindow: boolean;
}

const DEFAULT_SETTINGS: LavadocsPluginSettings = {
	lavaKey: '',
	url: "https://lavadocs.com",
	openNewWindow: true
}

export default class LavadocsPlugin extends Plugin {
	settings: LavadocsPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "push-to-lavadocs",
			name: "Push",
			checkCallback: (checking: boolean) => {
				const activeFilePresent = this.app.workspace.getActiveFile() != null;

				if (activeFilePresent) {
					if (!checking) {
						this.getActiveFileDetails().then(({ title, content, slug }) => {
							if (!title || !content || !slug) {
								return;
							}
							this.pushToLavadocs(title, content, slug);
						})
					}

					return true;
				}

				return false;
			},
		});
		
		const ribbonIconEl = this.addRibbonIcon('mountain', 'Push to Lavadocs', async (evt: MouseEvent) => {
			const { title, content, slug } = await this.getActiveFileDetails();
			
			if (!title || !content || !slug) {
				return;
			}
			this.pushToLavadocs(title, content, slug);
		});
		ribbonIconEl.addClass('lavadocs-ribbon-class');

		this.addSettingTab(new LavadocsSettings(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async pushToLavadocs(title: string, content: string, slug: string) {
		const lavadocsRequestParams: RequestUrlParam = {
			url: `${this.settings.url}/api/v1/documents`,
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

		const lavadocsResponse = requestUrl(lavadocsRequestParams);

		try {
			const data = await lavadocsResponse.json;
			new Notice("Pushed to Lavadocs!");

			if (this.settings.openNewWindow) {
				window.open(`${this.settings.url}/users/${data.username}/documents/${data.slug}`)
			}
		} catch (error) {
			if (error.status === 401) {
				new Notice("Unauthorized, the gates are closed! Check your Lava Key in the settings.");
				return;
			}

			if (error.status === 404) {
				new Notice("Instance of Lavadocs not found. Check the URL in the settings.");
				return;
			}

			if (error.message === "net::ERR_SSL_PROTOCOL_ERROR") {
				new Notice("SSL protocol error. Check that your Lavadocs instance is serving on https, or change your URL to regular http.");
				return;
			}
	
			new Notice(`Error pushing to Lavadocs: ${error.message}`);
			console.error(error);
			return;
		}
	}

	async getActiveFileDetails() {
		const activeFile = this.app.workspace.getActiveFile();

		if (activeFile) {
			const title = activeFile.basename;
			const content = await this.app.vault.cachedRead(activeFile);
			const titleLowercaseCharsOnly = activeFile.basename.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, "")
			const slug = titleLowercaseCharsOnly.replace(/\s+/g, "-");
			
			if (!title || !content || !slug) {
				new Notice("Can't push an empty file");
				return { title: null, content: null, slug: null };
			}

			return { title, content, slug };
		} 
			
		new Notice("No active file");
		return { title: null, content: null, slug: null };
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
		
		new Setting(containerEl)
		.setName("Hosted URL")
		.setDesc("If you're hosting your own Lavadocs instance, enter the full url here.")
		.addText(text => text
			.setPlaceholder('https://lavadocs.com')
			.setValue(this.plugin.settings.url)
			.onChange(async (value) => {
				this.plugin.settings.url = value;
				await this.plugin.saveSettings();
			}));
	}
}
