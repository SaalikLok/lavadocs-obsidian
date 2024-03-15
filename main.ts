import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface LavadocsPluginSettings {
	lavaKey: string;
	username: string;
}

const DEFAULT_SETTINGS: LavadocsPluginSettings = {
	lavaKey: '',
	username: ''
}

export default class LavadocsPlugin extends Plugin {
	settings: LavadocsPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('mountain', 'Push to Lavadocs', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			
			this.pushToLavadocs();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'push-to-lavadocs',
			name: 'Push to Lavadocs',
			callback: () => {
				this.pushToLavadocs();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new LavadocsSettings(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async pushToLavadocs() {
		fetch("https://lavadocs.com/api/v1/documents", {
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
		}).then(response => { 
			const dataPromise = response.json();
			dataPromise.then(data => {
				window.open(`https://lavadocs.com/users/${this.settings.username}/documents/${data.slug}`)
			})
			new Notice("Pushed to Lavadocs!");
		}, error => {
			new Notice("Error pushing to Lavadocs");
			console.error(error);
		});
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
			.setDesc("Get this from your lavadocs.com account. Keep it secret, keep it safe!")
			.addText(text => text
				.setPlaceholder('Enter your key')
				.setValue(this.plugin.settings.lavaKey)
				.onChange(async (value) => {
					this.plugin.settings.lavaKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Username")
			.setDesc("Your Lavadocs username, also grab it from your settings page in Lavadocs.")
			.addText(text => text
				.setPlaceholder('Your Username')
				.setValue(this.plugin.settings.username)
				.onChange(async (value) => {
					this.plugin.settings.username = value;
					await this.plugin.saveSettings();
				}));
	}
}
