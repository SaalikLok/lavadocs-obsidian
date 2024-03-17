import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

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

		const ribbonIconEl = this.addRibbonIcon('mountain', 'Push to Lavadocs', (evt: MouseEvent) => {			
			this.pushToLavadocs();
		});
		ribbonIconEl.addClass('lavadocs-ribbon-class');

		this.addCommand({
			id: 'push-to-lavadocs',
			name: 'Push to Lavadocs',
			callback: () => {
				this.pushToLavadocs();
			}
		});

		this.addSettingTab(new LavadocsSettings(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async pushToLavadocs() {
		const response = await fetch("https://lavadocs.com/api/v1/documents", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `${this.settings.lavaKey}`
			},
			body: JSON.stringify({
				document : {
					title: await this.getActiveFileName(),
					content: await this.getActiveFileContent(),
					slug: await this.sluggifiedFileName()
				}
			})
		})
		
		const data = await response.json();

		if (data.error) {
			if (data.error === "Unauthorized") {
				new Notice("Unauthorized, the gates are closed! Check your Lava Key in the settings.");
				return;
			}

			new Notice(`Error pushing to Lavadocs: ${data.error}`);
			console.error(data.error);
			return;
		}

		new Notice("Pushed to Lavadocs!");

		if (this.settings.openNewWindow) {
			window.open(`https://lavadocs.com/users/${data.username}/documents/${data.slug}`)
		}
	}

	async getActiveFileName() {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			const name = activeFile.basename;
			return name;
		} else {
			new Notice("No active file");
		}
	}

	async getActiveFileContent() {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			const fileData = await this.app.vault.read(activeFile);
			return fileData;
		}
	}

	async sluggifiedFileName() {
		const activeFile = this.app.workspace.getActiveFile();

		if (activeFile) {
			const titleLowercaseCharsOnly = activeFile.basename.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, "")
			const titleSluggified = titleLowercaseCharsOnly.replace(/\s+/g, "-");
			return titleSluggified;
		}
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
