const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Clutter = imports.gi.Clutter;

const refresh_rate = 32; // Blur refresh rate (milliseconds)

class SemabeGlassDesigner {
	constructor(metadata) {
		this.metadata = metadata;
		this._settings = new Settings.ExtensionSettings(this, metadata.uuid);

		this._desktopSettings = new Gio.Settings({
			schema_id: 'org.cinnamon.theme'
		});
		this._updateGlassShadeFromTheme(this._desktopSettings.get_string('name'));

		this._themeHandlerId = this._desktopSettings.connect('changed::name', () => {
			let currentTheme = this._desktopSettings.get_string('name');
			this._updateGlassShadeFromTheme(currentTheme);
			// Main.notify("Semabe Glass Blur", `Theme color: ${this.glassShade}`);
			this._updateColorClassesOnExisting();
		});

		this._uiGroupSignalId = 0;
		this._origPopupMenuOpen = null;
		this._origPopupMenuClose = null;
		this._origNotifyUpdate = null;
		this._origNotifyOnScreen = null;

		this._bindSettings();
		this._updatePatches();
	}

	_bindSettings() {
		this._settings.bind("backgd-blur-menus", "backgdBlurMenus");
		this._settings.bind("backgd-blur-notifications", "backgdBlurNotifications");
		this._settings.bind("surface-style-menus", "surfaceStyleMenus");
		this._settings.bind("surface-style-notifications", "surfaceStyleNotifications");
		this._settings.bind("backgd-blur-strength-menus", "bgBlurStrengthMenus");
		this._settings.bind("light-refraction-menus", "lightRefractionMenus");
		this._settings.bind("backgd-blur-strength-notifications", "bgBlurStrengthNotifications");
		this._settings.bind("light-refraction-notifications", "lightRefractionNotifications");

		this._settings.connect("changed::surface-style-menus", () => this._updateColorClassesOnExisting());
		this._settings.connect("changed::surface-style-notifications", () => this._updateColorClassesOnExisting());
		this._settings.connect("changed::backgd-blur-menus", () => this._updatePatches());
		this._settings.connect("changed::backgd-blur-notifications", () => this._updatePatches());
	}

	btn_website_pressed() {
		Gio.app_info_launch_default_for_uri("https://www.cinnamon-look.org/p/2025684", null);
	}

	_updateGlassShadeFromTheme(themeName) {
		const themeMap = {
			'Semabe Azure': 'azure',
			'Semabe Mint': 'mint',
			'Semabe Cinnamon': 'cinnamon',
			'Semabe Nordic': 'nordic',
			'Semabe Crimson': 'crimson',
			'Semabe Steel': 'steel',
			'Semabe Falcon': 'falcon',
			'Semabe Violet': 'violet',
			'Semabe Grey': 'grey'
		};

		this.glassShade = "noSemabeShade";
		for (let key in themeMap) {
			if (themeName.includes(key)) {
				this.glassShade = themeMap[key];
				break;
			}
		}
	}

	_updatePatches() {
		if (this.backgdBlurMenus) {
			this._patchPopupMenu();
			this._patchAllMenus();
		} else {
			this._unpatchPopupMenu();
			this._unpatchAllMenus();
			Main.uiGroup.get_children().forEach(actor => {
				if (actor.toString().toLowerCase().includes('menu')) {
					this._removeStylerClassesOnly(actor);
					actor.set_style(null);
				}
			});
		}

		if (this.backgdBlurNotifications) {
			this._patchNotifications();
		} else {
			this._unpatchNotifications();
			Main.uiGroup.get_children().forEach(actor => {
				if (actor.toString().includes('Notification')) {
					this._removeStylerClassesOnly(actor);
					actor.set_style(null);
				}
			});
		}

		this._updateColorClassesOnExisting();
	}

	_applyColorClassMenus(actor, baseName) {
		if (!actor || typeof actor.add_style_class_name !== 'function') return;

		this._removeStylerClassesOnly(actor);

		if (this.surfaceStyleMenus === "pane") {
			actor.add_style_class_name(`${baseName}-pane-${this.glassShade}`);
		} else if (this.surfaceStyleMenus === "tempered") {
			actor.add_style_class_name(`${baseName}-tempered-${this.glassShade}`);
		//} else if (this.surfaceStyleMenus === "plexi") {
		//	actor.add_style_class_name(`${baseName}-plexi-${this.glassShade}`);
		}

		actor.queue_redraw();
	}

	_applyColorClassNotifications(actor, baseName) {
		if (!actor || typeof actor.add_style_class_name !== 'function') return;

		this._removeStylerClassesOnly(actor);

		if (this.surfaceStyleNotifications === "pane") {
			actor.add_style_class_name(`${baseName}-pane-${this.glassShade}`);
		} else if (this.surfaceStyleNotifications === "tempered") {
			actor.add_style_class_name(`${baseName}-tempered-${this.glassShade}`);
		//} else if (this.surfaceStyleNotifications === "plexi") {
		//	actor.add_style_class_name(`${baseName}-plexi-${this.glassShade}`);
		}

		actor.queue_redraw();
	}

	_removeStylerClassesOnly(actor) {
		if (!actor || typeof actor.get_style_class_name !== 'function') return;

		let currentClasses = actor.get_style_class_name() || "";
		let classList = currentClasses.split(/\s+/);

		classList.forEach(cls => {
			if (cls && cls.startsWith('semabe-blur-')) {
				actor.remove_style_class_name(cls);
			}
		});
	}

	_removeAllStylerClassesRecursive(actor) {
		if (!actor) return;
		this._removeStylerClassesOnly(actor);
		if (actor.get_children) {
			actor.get_children().forEach(child => this._removeAllStylerClassesRecursive(child));
		}
	}

	_updateColorClassesOnExisting() {
		Main.uiGroup.get_children().forEach(actor => {
			if (!actor || actor.is_finalized?.()) return;

			let actorStr = actor.toString();

			this._removeStylerClassesOnly(actor);

			let hasMenuClass = false;
			try {
				hasMenuClass = actor.has_style_class_name && actor.has_style_class_name('popup-menu');
			} catch (e) {
				hasMenuClass = false;
			}

			if (this.backgdBlurMenus && (hasMenuClass || actorStr.toLowerCase().includes('menu'))) {
				this._applyColorClassMenus(actor, 'semabe-blur-popup');
			}

			if (this.backgdBlurNotifications && actorStr.includes('Notification')) {
				this._applyColorClassNotifications(actor, 'semabe-blur-notification');
			}
		});
	}

	_patchAllMenus() {
		if (this._uiGroupSignalId) return;
		this._uiGroupSignalId = Main.uiGroup.connect('actor-added', (container, actor) => {
			let actorStr = actor.toString();
			let isMenu = actor.has_style_class_name?.('menu') ||
				actorStr.includes('menu');

			if (isMenu) {
				GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => {
					this._styleGenericMenu(actor);
					return GLib.SOURCE_REMOVE;
				});
			}
		});
	}

	_styleGenericMenu(actor) {
		if (!actor || actor.is_finalized?.()) return;

		let applyStyles = () => {
			if (!actor || actor.is_finalized?.()) return;
			this._applyColorClassMenus(actor, 'semabe-blur-popup');
			actor.set_style(`
background-blur: ${this.bgBlurStrengthMenus}px;
background-bumpmap: ${this.lightRefractionMenus === 'none' ? 'none' : `url("${GLib.get_home_dir()}/.local/share/cinnamon/extensions/semabe-theme-blur@sewbej/refraction/${this.lightRefractionMenus}")`};
border-radius: 12px;
`);
		};

		applyStyles();

		actor.connect('notify::style', () => {
			if (actor && actor.visible && !actor.get_style()) {
				applyStyles();
			}
		});

		if (actor._genericBlurId) GLib.source_remove(actor._genericBlurId);
		actor._genericBlurId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, refresh_rate, () => {
			if (actor && !actor.is_finalized?.() && actor.visible) {
				actor.queue_redraw();
				return GLib.SOURCE_CONTINUE;
			}
			return GLib.SOURCE_REMOVE;
		});
	}

	_unpatchAllMenus() {
		if (this._uiGroupSignalId) {
			Main.uiGroup.disconnect(this._uiGroupSignalId);
			this._uiGroupSignalId = 0;
		}
		Main.uiGroup.get_children().forEach(actor => {
			let actorStr = actor.toString().toLowerCase();
			if (actorStr.includes('menu')) {
				if (actor._genericBlurId) {
					GLib.source_remove(actor._genericBlurId);
					actor._genericBlurId = 0;
				}
				actor.set_style(null);
				this._removeStylerClassesOnly(actor);
			}
		});
	}

	_patchNotifications() {
		const MessageTray = imports.ui.messageTray;
		if (this._origNotifyUpdate) return;

		let self = this;
		this._origNotifyUpdate = MessageTray.Notification.prototype.update;
		this._origNotifyOnScreen = MessageTray.Notification.prototype._styleForScreen;

		MessageTray.Notification.prototype.update = function(title, banner, params) {
			let res = self._origNotifyUpdate.call(this, title, banner, params);
			if (this.actor) self._styleNotificationActor(this.actor);
			return res;
		};

		MessageTray.Notification.prototype._styleForScreen = function() {
			if (self._origNotifyOnScreen) self._origNotifyOnScreen.call(this);
			self._styleNotificationActor(this.actor);
		};
	}

	_styleNotificationActor(actor) {
		if (!actor || actor.is_finalized?.()) return;

		actor.set_style(`
background-color: transparent !important;
background-blur: ${this.bgBlurStrengthNotifications}px;
background-bumpmap: ${this.lightRefractionNotifications === 'none' ? 'none' : `url("${GLib.get_home_dir()}/.local/share/cinnamon/extensions/semabe-theme-blur@sewbej/refraction/${this.lightRefractionNotifications}")`};
border-radius: 12px;
margin: 0px !important;
`);

		GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
			if (actor && !actor.is_finalized?.()) {
				this._applyColorClassNotifications(actor, 'semabe-blur-notification');
			}
			return GLib.SOURCE_REMOVE;
		});

		if (actor._notifyRefreshId) GLib.source_remove(actor._notifyRefreshId);
		actor._notifyRefreshId = GLib.timeout_add(GLib.PRIORITY_LOW, refresh_rate, () => {
			if (!actor || (actor.is_finalized && actor.is_finalized())) return GLib.SOURCE_REMOVE;
			actor.queue_redraw();
			return GLib.SOURCE_CONTINUE;
		});
	}

	_unpatchNotifications() {
		const MessageTray = imports.ui.messageTray;
		if (this._origNotifyUpdate) {
			MessageTray.Notification.prototype.update = this._origNotifyUpdate;
			this._origNotifyUpdate = null;
		}
		if (this._origNotifyOnScreen) {
			MessageTray.Notification.prototype._styleForScreen = this._origNotifyOnScreen;
			this._origNotifyOnScreen = null;
		}
	}

	_patchPopupMenu() {
		if (this._origPopupMenuOpen) return;
		let self = this;
		this._origPopupMenuOpen = PopupMenu.PopupMenu.prototype.open;
		this._origPopupMenuClose = PopupMenu.PopupMenu.prototype.close;

		PopupMenu.PopupMenu.prototype.open = function(animate) {
			self._origPopupMenuOpen.call(this, animate);
			self._applyColorClassMenus(this.actor, 'semabe-blur-popup');
			this.actor.set_style(`
background-blur: ${self.bgBlurStrengthMenus}px;
background-bumpmap: ${self.lightRefractionMenus === 'none' ? 'none' : `url("${GLib.get_home_dir()}/.local/share/cinnamon/extensions/semabe-theme-blur@sewbej/refraction/${self.lightRefractionMenus}")`};
border-radius: 12px;
`);

			this.actor.set_translation(0.6, 0, 0.6);
			if (this.box) this.box.set_translation(-0.6, 0, -0.6);

			if (this._menuBlurRedrawId) GLib.source_remove(this._menuBlurRedrawId);
			this._menuBlurRedrawId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, refresh_rate, () => {
				if (this.isOpen && this.actor) {
					this.actor.queue_redraw();
					return GLib.SOURCE_CONTINUE;
				}
				return GLib.SOURCE_REMOVE;
			});
		};

		PopupMenu.PopupMenu.prototype.close = function(animate) {
			if (!animate) {
				if (this.actor) {
					self._removeStylerClassesOnly(this.actor);
					this.actor.set_style(null);
				}
			} else {
				GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
					if (this.actor && !this.isOpen) {
						self._removeStylerClassesOnly(this.actor);
						this.actor.set_style(null);
					}
					return GLib.SOURCE_REMOVE;
				});
			}
			if (this._menuBlurRedrawId) {
				GLib.source_remove(this._menuBlurRedrawId);
				this._menuBlurRedrawId = 0;
			}
			self._origPopupMenuClose.call(this, animate);
		};
	}

	_unpatchPopupMenu() {
		if (this._origPopupMenuOpen) {
			PopupMenu.PopupMenu.prototype.open = this._origPopupMenuOpen;
			PopupMenu.PopupMenu.prototype.close = this._origPopupMenuClose;
			this._origPopupMenuOpen = null;
			this._origPopupMenuClose = null;
		}
	}

	destroy() {
		if (this._themeHandlerId) {
			this._desktopSettings.disconnect(this._themeHandlerId);
		}

		this._unpatchPopupMenu();
		this._unpatchNotifications();
		this._unpatchAllMenus();

		Main.uiGroup.get_children().forEach(actor => {
			if (!actor || actor.is_finalized?.()) return;

			this._removeStylerClassesOnly(actor);

			let actorStr = actor.toString().toLowerCase();
			if (actorStr.includes('menu') || actorStr.includes('notification')) {
				actor.set_style(null);
			}
		});

		this._settings.finalize();
	}
}




let styler = null;
let savedMetadata = null;

var Callbacks = {
	btn_website_pressed: function() {
		this.btn_website_pressed();
	}
};

function init(metadata) {
	savedMetadata = metadata;
}

function enable() {
	styler = new SemabeGlassDesigner(savedMetadata);

	let boundCallbacks = {};
	Object.keys(Callbacks).forEach(k => {
		boundCallbacks[k] = Callbacks[k].bind(styler);
	});

	return boundCallbacks;
}

function disable() {
	if (styler) {
		styler.destroy();
		styler = null;
	}
}
