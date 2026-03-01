const UUID = "semabe-theme-selector@sewbej";
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const SignalManager = imports.misc.signalManager;
const ICON_SCHEMA = "org.cinnamon.desktop.interface";

class ThemeSelectorExtension {
    constructor(meta) {
        this.meta = meta;

        this.color = "Steel";
        this.transparency = "Opaque";
        this.windowControls = "legacy";
        this.size = "L";

        this.colorCinn = "Steel";
        this.transparencyCinn = "Opaque";
        this.windowControlsCinn = "legacy";

        this.wmSettings = new Gio.Settings({ schema: "org.cinnamon.desktop.wm.preferences" });
        this.wmSettingsChangedId = null;
        this.interfaceSettings = new Gio.Settings({ schema: ICON_SCHEMA });
        this.iconThemeChangedId = null;

        Gettext.bindtextdomain(meta.uuid, GLib.get_home_dir() + "/.local/share/locale");
        this._isUpdating = false;
    }

    enable() {
        this.settings = new Settings.ExtensionSettings(this, this.meta.uuid);

        this.settings.bind("color", "color", this.onSettingsChanged.bind(this));
        this.settings.bind("transparency", "transparency", this.onSettingsChanged.bind(this));
        this.settings.bind("window-controls", "windowControls", this.onSettingsChanged.bind(this));
        this.settings.bind("color-cinn", "colorCinn", this.onSettingsChanged.bind(this));
        this.settings.bind("transparency-cinn", "transparencyCinn", this.onSettingsChanged.bind(this));
        this.settings.bind("window-controls", "windowControlsCinn", this.onSettingsChanged.bind(this));
        this.settings.bind("controls-style", "controlsstyle", this.onSettingsChanged.bind(this));
        this.settings.bind("arrows-style", "arrowsstyle", this.onSettingsChanged.bind(this));
        this.settings.bind("size1", "size1", this.onSettingsChanged.bind(this));
        this.settings.bind("size2", "size2", this.onSettingsChanged.bind(this));
        this.settings.bind("size3", "size3", this.onSettingsChanged.bind(this));
        this.settings.bind("size4", "size4", this.onSettingsChanged.bind(this));
        this.settings.bind("size5", "size5", this.onSettingsChanged.bind(this));
        this.settings.bind("size6", "size6", this.onSettingsChanged.bind(this));
        this.settings.bind("size7", "size7", this.onSettingsChanged.bind(this));

        this._updateUnifiedSize();

        if (!this.targetDir || this.targetDir.trim() === "") {
            const detected = this.interfaceSettings.get_string("icon-theme");
            if (detected) {
                this.targetDir = detected;
                if (this.settings && typeof this.settings.set_string === "function") {
                    this.settings.set_string("directory-select", detected);
                }
            }
        }

        this.iconThemeChangedId = this.interfaceSettings.connect("changed::icon-theme", () => {
            const newTheme = this.interfaceSettings.get_string("icon-theme");
            if (newTheme && newTheme !== this.targetDir) {
                this.targetDir = newTheme;
                if (this.settings && typeof this.settings.set_string === "function") {
                    this.settings.set_string("directory-select", newTheme);
                }
            }
        });

        const themeName = this.buildThemeName();
        const themeNameCinn = this.buildThemeNameCinn();
        this.applyTheme(themeName, themeNameCinn);

        this.wmSettingsChangedId = this.wmSettings.connect("changed::button-layout", () => {
            this.onSettingsChanged();
        });
    }

    disable() {
        if (this.wmSettingsChangedId && this.wmSettings) {
            this.wmSettings.disconnect(this.wmSettingsChangedId);
            this.wmSettingsChangedId = null;
        }
        if (this.iconThemeChangedId && this.interfaceSettings) {
            this.interfaceSettings.disconnect(this.iconThemeChangedId);
            this.iconThemeChangedId = null;
        }
        if (this.settings && this.settings.finalize)
            this.settings.finalize();
        this.settings = null;
    }

    _validateSize() {
        const sizeMap = {
            legacy: ["L"],
            ambiance: ["M", "L"],
            macOS: ["S", "M", "L", "XL", "XXL"],
            breeze: ["S", "M", "L", "XL", "XXL"],
            LED: ["S", "M", "L"],
            zephyr: ["S", "M", "L"],
            human: ["S", "M", "L"]
        };

        const windowControls = this.windowControls || "";
        const size = this.size || "";

        if (windowControls in sizeMap) {
            const availableSizes = sizeMap[windowControls];
            if (!availableSizes.includes(size)) {
                this.size = "L";
                if (this.settings && typeof this.settings.set_string === "function") {
                    this.settings.set_string("size1", "L"); 
                }

                Main.notify(
                    _("Theme Selector"),
                    _(`Size "${size}" not supported for "${windowControls}". Reset to "L".`)
                );
            }
        }
    }

    _updateUnifiedSize() {
        if (this._updatingSize) return;
        this._updatingSize = true;

        switch (this.windowControls) {
            case "legacy": this.size = this.size1; break;
            case "ambiance": this.size = this.size2; break;
            case "macOS": this.size = this.size3; break;
            case "breeze": this.size = this.size4; break;
            case "LED": this.size = this.size5; break;
            case "zephyr": this.size = this.size6; break;
            case "human": this.size = this.size7; break;
            default: this.size = "L"; break;
        }

        this._updatingSize = false;
    }

    onSettingsChanged() {
        if (this._isUpdating) return;

        this._isUpdating = true;
    
        this._updateUnifiedSize();
        this._validateSize();

        const themeName = this.buildThemeName();
        const themeNameCinn = this.buildThemeNameCinn();
        this.applyTheme(themeName, themeNameCinn);
    
        this._isUpdating = false;
    }

    buildThemeName() {
        const layout = this.wmSettings.get_string("button-layout");
        const layoutSuffix = this.mapLayoutToLetter(layout);
        return `Semabe ${this.color} ${this.transparency} (${this.windowControls})${this.size}${layoutSuffix}`;
    }

    buildThemeNameCinn() {
        return `Semabe ${this.colorCinn} ${this.transparencyCinn} (${this.windowControlsCinn})LR`;
    }

    buildThemePath(themeName) {
        const layoutRaw = this.wmSettings.get_string("button-layout");
        const layoutSuffix = this.mapLayoutToLetter(layoutRaw);
        
        const layoutMap = { R: "right", L: "left", M: "classic_mac", G: "gnome" };
        const layoutName = layoutMap[layoutSuffix] || "right";

        const sizeMap = {
            S: "small", M: "medium", L: "large", XL: "extra-large", XXL: "extra-extra-large"
        };
        const sizeName = sizeMap[this.size] || "large";

        const windowControls = this.windowControls || "legacy";
        const classicThemes = ["macOS", "breeze", "human"];

        let path;
        let finalThemeName = themeName;

        if (windowControls === "legacy") {
            finalThemeName = themeName.replace(/[RLMG]$/, "").replace(/(S|M|L|XL|XXL)$/, "");
            path = `semabe/${windowControls}/${finalThemeName}`;
        } else if (classicThemes.includes(windowControls)) {
            finalThemeName = themeName.replace(/[RLMG]$/, "");
            path = `semabe/${windowControls}/${sizeName}/${finalThemeName}`;
        } else {
            path = `semabe/${windowControls}/${layoutName}/${sizeName}/${finalThemeName}`;
        }

        return path;
    }

    buildThemePathCinn(themeNameCinn) {
        const layoutName = "right";
        const sizeName = "large";
        const windowControls = this.windowControlsCinn || "legacy";
        const classicThemes = ["macOS", "breeze", "human"];

        let pathCinn;
        let finalThemeNameCinn = themeNameCinn;

        if (windowControls === "legacy") {
            finalThemeNameCinn = themeNameCinn.replace(/[RLMG]$/, "").replace(/(S|M|L|XL|XXL)$/, "");
            pathCinn = `semabe/${windowControls}/${finalThemeNameCinn}`;
        } else if (classicThemes.includes(windowControls)) {
            finalThemeNameCinn = themeNameCinn.replace(/[RLMG]$/, "");
            pathCinn = `semabe/${windowControls}/${sizeName}/${finalThemeNameCinn}`;
        } else {
            pathCinn = `semabe/${windowControls}/${layoutName}/${sizeName}/${finalThemeNameCinn}`;
        }
        return pathCinn;
    }

    mapLayoutToLetter(layout) {
        if (!layout || typeof layout !== "string") return "R";
        layout = layout.trim().replace(/\s+/g, "").replace(/,,+/g, ",");

        switch (layout) {
            case "close,maximize,minimize:": return "L";
            case ":minimize,maximize,close": return "R";
            case "close:": case ":close": return "G";
            case "close:minimize,maximize": return "M";
        }

        if (layout.startsWith(":")) return "R";
        if (layout.endsWith(":")) return "L";
        if (layout.includes("close:")) return "M";
        if (layout.includes("close")) return "G";
        return "R";
    }

    applyTheme(themeGtk, themeCinn) {
        const path = this.buildThemePath(themeGtk);
        const pathCinn = this.buildThemePathCinn(themeCinn);
        const scriptPath = `${GLib.get_home_dir()}/.local/share/cinnamon/extensions/${UUID}/flatpak.py`;

        this.interfaceSettings.set_string("gtk-theme", path);
        new Gio.Settings({ schema: "org.cinnamon.theme" }).set_string("name", pathCinn);

        let proc = Gio.Subprocess.new(
            ["python3", scriptPath, path],
            Gio.SubprocessFlags.NONE
        );
        
        proc.wait_async(null, (p, res) => {
            try {
                p.wait_finish(res);
            } catch (e) {
                global.logError("Error during Flatpak theme update: " + e);
            }
        });
    }
}

function runThemeScript(mode, style, targetDir) {
    const homeDir = GLib.get_home_dir();
    const scriptPath = `${homeDir}/.local/share/cinnamon/extensions/${UUID}/replace_symbolic_icon.py`;

    if (!targetDir) {
        const s = new Gio.Settings({ schema: ICON_SCHEMA });
        targetDir = s.get_string("icon-theme");
    }

    try {
        let proc = Gio.Subprocess.new(
            ["python3", scriptPath, mode, style, targetDir],
            Gio.SubprocessFlags.NONE
        );
        
        proc.wait_async(null, (p, res) => {
            if (p.wait_finish(res)) {
                refreshIconTheme(targetDir);
            }
        });
    } catch (e) {
        global.logError(e);
    }
}

function refreshIconTheme(targetDir) {
    const s = new Gio.Settings({ schema: ICON_SCHEMA });
    s.set_string("icon-theme", "");
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
        s.set_string("icon-theme", targetDir);
        return GLib.SOURCE_REMOVE;
    });
}

function openWebsite(url) {
    Util.spawnCommandLine("xdg-open " + url);
}

var Callbacks = {
    btn_controls_pressed: function () {
        runThemeScript("controls", this.controlsstyle, this.targetDir);
    },
    btn_arrows_pressed: function () {
        runThemeScript("arrows", this.arrowsstyle, this.targetDir);
    },
    btn_restore_pressed: function () {
        runThemeScript("restore", "-", this.targetDir);
    },
    btn_website_pressed: function () {
        openWebsite("https://www.cinnamon-look.org/p/2025684");
    },
};

let extension = null;

function init(metadata) {
    extension = new ThemeSelectorExtension(metadata);
}

function enable() {
    extension.enable();

    let boundCallbacks = {};
    Object.keys(Callbacks).forEach(k => {
        boundCallbacks[k] = Callbacks[k].bind(extension);
    });
    return boundCallbacks;
}

function disable() {
    extension.disable();
    extension = null;
}
