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

        this.settings = new Settings.ExtensionSettings(this, meta.uuid);
        this.settings.bind("color", "color", this.onSettingsChanged.bind(this));
        this.settings.bind("transparency", "transparency", this.onSettingsChanged.bind(this));
        this.settings.bind("window-controls", "windowControls", this.onSettingsChanged.bind(this));
        this.settings.bind("color-cinn", "colorCinn", this.onSettingsChanged.bind(this));
        this.settings.bind("transparency-cinn", "transparencyCinn", this.onSettingsChanged.bind(this));
        this.settings.bind("window-controls", "windowControlsCinn", this.onSettingsChanged.bind(this));
        this.settings.bind("controls-style", "controlsstyle", this.onSettingsChanged.bind(this));
        this.settings.bind("arrows-style", "arrowsstyle", this.onSettingsChanged.bind(this));
       //this.settings.bind("directory-select", "targetDir", this.onSettingsChanged.bind(this));

        this.settings.bind("size1", "size1", this.onSettingsChanged.bind(this));
        this.settings.bind("size2", "size2", this.onSettingsChanged.bind(this));
        this.settings.bind("size3", "size3", this.onSettingsChanged.bind(this));
        this.settings.bind("size4", "size4", this.onSettingsChanged.bind(this));
        this.settings.bind("size5", "size5", this.onSettingsChanged.bind(this));
        this.settings.bind("size6", "size6", this.onSettingsChanged.bind(this));
        this.settings.bind("size7", "size7", this.onSettingsChanged.bind(this));

        this.wmSettings = new Gio.Settings({ schema: "org.cinnamon.desktop.wm.preferences" });
        this.wmSettingsChangedId = null;
        this.interfaceSettings = new Gio.Settings({ schema: ICON_SCHEMA });
        this.iconThemeChangedId = null;


        Gettext.bindtextdomain(meta.uuid, GLib.get_home_dir() + "/.local/share/locale");
    }

    enable() {
        this._updateUnifiedSize();
    // Auto-detect targetDir if empty
    if (!this.targetDir || this.targetDir.trim() === "") {
      const detected = getCurrentIconTheme();
      if (detected) {
        this.targetDir = detected;
        if (this.settings && typeof this.settings.set_string === "function") {
          this.settings.set_string("directory-select", detected);
        }
        //Main.notify("Semabe Theme Selector", `Detected current icon theme: ${detected}`);
      }
    }
    // Listen for changes to the system icon theme
    this.iconThemeChangedId = this.interfaceSettings.connect("changed::icon-theme", () => {
        const newTheme = this.interfaceSettings.get_string("icon-theme");
        if (newTheme && newTheme !== this.targetDir) {
            this.targetDir = newTheme;
            if (this.settings && typeof this.settings.set_string === "function") {
                this.settings.set_string("directory-select", newTheme);
            }
            //Main.notify("Semabe Theme Selector", `Detected icon theme change: ${newTheme}`);
        }
    });

        const themeName = this.buildThemeName();
        const themeNameCinn = this.buildThemeNameCinn();
        this.applyTheme(themeName, themeNameCinn);

        this.wmSettingsChangedId = this.wmSettings.connect("changed::button-layout", () => {
            const updatedGtk = this.buildThemeName();
            const updatedCinn = this.buildThemeNameCinn();
            this.applyTheme(updatedGtk, updatedCinn);
        });
    }

    disable() {
        if (this.wmSettingsChangedId && this.wmSettings) {
            this.wmSettings.disconnect(this.wmSettingsChangedId);
            this.wmSettingsChangedId = null;
        }
        if (this.settings && this.settings.finalize)
            this.settings.finalize();
        this.settings = null;
        if (this.iconThemeChangedId && this.interfaceSettings) {
            this.interfaceSettings.disconnect(this.iconThemeChangedId);
            this.iconThemeChangedId = null;
        }

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
                    this.settings.set_string("size", "L");
                }

                Main.notify(
                    `Unsupported size "${size}" for style "${windowControls}".`,
                    `Size has been reset to "L".`
                );

                GLib.spawn_command_line_async("pkill -f xlet-settings");
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 0, () => {
                    GLib.spawn_command_line_async("xlet-settings extension semabe-theme-selector@sewbej");
                    return GLib.SOURCE_REMOVE;
                });
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

        this._validateSize();

        const themeName = this.buildThemeName();
        const themeNameCinn = this.buildThemeNameCinn();
        this.applyTheme(themeName, themeNameCinn);
    }

    buildThemeName() {
        const layout = this.wmSettings.get_string("button-layout");
        const layoutSuffix = this.mapLayoutToLetter(layout);
        return `Semabe ${this.color} ${this.transparency} (${this.windowControls})${this.size}${layoutSuffix}`;
    }

    buildThemeNameCinn() {
        const layoutSuffix = "R";
        const sizeSuffix = "L";
        return `Semabe ${this.colorCinn} ${this.transparencyCinn} (${this.windowControlsCinn})${sizeSuffix}${layoutSuffix}`;
    }

    buildThemePath(themeName) {
        const layoutRaw = GLib.spawn_command_line_sync(
            "gsettings get org.cinnamon.desktop.wm.preferences button-layout"
        )[1].toString().trim().replace(/'/g, "");

        const layoutSuffix = this.mapLayoutToLetter(layoutRaw);
        const layoutMap = { R: "right", L: "left", M: "classic_mac", G: "gnome" };
        const layoutName = layoutMap[layoutSuffix] || "right";

        const sizeMap = {
            S: "small", M: "medium", L: "large", XL: "extra-large", XXL: "extra-extra-large"
        };
        const sizeName = sizeMap[this.size] || "large";

        const windowControls = this.windowControls || "legacy";
        const classicThemes = ["macOS", "breeze", "human"];
        const legacyTheme = "legacy";

        let path;
        let finalThemeName = themeName;

        if (windowControls === legacyTheme) {
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
        const legacyTheme = "legacy";

        let pathCinn;
        let finalThemeNameCinn = themeNameCinn;

        if (windowControls === legacyTheme) {
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
    /**
     * Safely get a string setting from the extension settings.
     * Tries several fallbacks because different Cinnamon versions expose ExtensionSettings differently.
     * Returns defaultValue if not found.
     */
    getSettingString(key, defaultValue = "") {
        try {
            // 1) If the ExtensionSettings wrapper exposes get_string directly (some versions)
            if (this.settings && typeof this.settings.get_string === "function") {
                return this.settings.get_string(key);
            }

            // 2) If ExtensionSettings stores the underlying Gio.Settings in a private field (common pattern)
            if (this.settings && this.settings._settings && typeof this.settings._settings.get_string === "function") {
                return this.settings._settings.get_string(key);
            }

            // 3) As a last resort, try to build a Gio.Settings with the extension schema id.
            //    The schema name can vary — try common patterns. Adjust schemaName if you know it.
            const possibleSchemas = [
                this.meta && this.meta.uuid ? `org.cinnamon.extensions.${this.meta.uuid}` : null,
                this.meta && this.meta.uuid ? `${this.meta.uuid}` : null,
                "org.cinnamon.shell.extensions.semabe-theme-selector", // fallback guesses
            ].filter(Boolean);

            for (let schemaName of possibleSchemas) {
                try {
                    const s = new Gio.Settings({ schema: schemaName });
                    if (s && typeof s.get_string === "function") {
                        return s.get_string(key);
                    }
                } catch (e) {
                    // schema not found — ignore and continue
                }
            }
        } catch (e) {
            global.logError(e);
        }

        return defaultValue;
    }

    applyTheme(themeGtk, themeCinn) {
        const path = this.buildThemePath(themeGtk);
        const pathCinn = this.buildThemePathCinn(themeCinn);
        const globalPath = `${GLib.get_home_dir()}/.local/share/flatpak/overrides/global`;

        Util.spawnCommandLine(`gsettings set org.cinnamon.desktop.interface gtk-theme "${path}"`);
        Util.spawnCommandLine(`gsettings set org.cinnamon.theme name "${pathCinn}"`);

        const bashScript = `
        FILE="${globalPath}"
        sed -i -E "s|^filesystems=.*|filesystems=~/.themes;/usr/share/themes|" "$FILE"
        sed -i -E "s|^GTK_THEME=.*|GTK_THEME=${path}|" "$FILE"
        `;

        GLib.spawn_async(null, ["/bin/bash", "-c", bashScript], null, GLib.SpawnFlags.SEARCH_PATH, null);
    }
}

function getCurrentIconTheme() {
  try {
    const s = new Gio.Settings({ schema: ICON_SCHEMA });
    return s.get_string("icon-theme") || "";
  } catch (e) {
    global.logError(e);
    return "";
  }
}

function refreshIconTheme(targetDir) {
  try {
    const command = `bash -c " \
      gsettings set org.cinnamon.desktop.interface icon-theme ''; \
      sleep 0.3; \
      gsettings set org.cinnamon.desktop.interface icon-theme '${targetDir}' \
    "`;
    Util.spawnCommandLine(command);
    global.log(`Icon theme refreshed: '${targetDir}'`);
  } catch (e) {
    global.logError(`Failed to refresh icon theme: ${e}`);
  }
}

function runThemeScript(mode, style, targetDir) {
  try {
    const homeDir = GLib.get_home_dir();
    const scriptPath = `${homeDir}/.local/share/cinnamon/extensions/semabe-theme-selector@sewbej/replace_symbolic_icon.py`;

    if (!targetDir || targetDir.trim() === "") {
      targetDir = getCurrentIconTheme() || "";
      if (!targetDir) {
        Main.notifyError("Semabe Theme Selector", "❌ No icon theme detected or selected!");
        return;
      }
      //Main.notify("Semabe Theme Selector", `Auto-detected icon theme: ${targetDir}`);
    }

    const scriptFile = Gio.File.new_for_path(scriptPath);
    if (!scriptFile.query_exists(null)) {
      Main.notifyError("Semabe Theme Selector", `Script not found:\n${scriptPath}`);
      return;
    }


    const proc = new Gio.Subprocess({
      argv: ["/usr/bin/python3", scriptPath, mode, style, targetDir],
      flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });

    proc.init(null);
    proc.communicate_utf8_async(null, null, (self, res) => {
      try {
        const [, stdoutStr, stderrStr] = proc.communicate_utf8_finish(res);
        const exitOk = proc.get_successful();
        const out = (stdoutStr || "").trim();
        const err = (stderrStr || "").trim();

        if (exitOk) {
          Main.notify("Semabe Theme Selector", out || "✅ Done!");
          refreshIconTheme(targetDir);
        } else {
          Main.notifyError("Semabe Theme Selector", `❌ Script failed${err ? `:\n${err}` : "."}`);
        }
      } catch (e) {
        Main.notifyError("Semabe Theme Selector", `Exception: ${e.message}`);
        global.logError(e);
      }
    });
  } catch (e) {
    Main.notifyError("Semabe Theme Selector", `Exception: ${e.message}`);
    global.logError(e);
  }
}

var Callbacks = {
  btn_controls_pressed: function () {
    runThemeScript("controls", extension.controlsstyle, extension.targetDir);
  },

  btn_arrows_pressed: function () {
    runThemeScript("arrows", extension.arrowsstyle, extension.targetDir);
  },

  btn_restore_pressed: function () {
    runThemeScript("restore", "-", extension.targetDir);
  },
};


function CubeSettings(uuid) {
    this._init(uuid);
}
CubeSettings.prototype = {
    _init: function(uuid) {
        this.settings = new Settings.ExtensionSettings(this, uuid);
    }
};


let extension = null;
let cubeSettings = null;
let signalManager = null;

function init(metadata) {
    extension = new ThemeSelectorExtension(metadata);
    cubeSettings = new CubeSettings(metadata.uuid);
    signalManager = new SignalManager.SignalManager(null);
}

function enable() {
    try {
        extension.enable();
    } catch (err) {
        try { extension.disable(); } catch (e) {}
        throw err;
    }
    Object.keys(Callbacks).forEach(k => {
        Callbacks[k] = Callbacks[k].bind(extension);
    });

    return Callbacks;
}

function disable() {
    try {
        extension.disable();
    } catch (err) {
        global.logError(err);
    }

    try {
        if (cubeSettings && cubeSettings.settings && typeof cubeSettings.settings.finalize === "function")
            cubeSettings.settings.finalize();
    } catch (e) {
        global.logError(e);
    }
    cubeSettings = null;

    if (signalManager && typeof signalManager.disconnectAllSignals === "function") {
        try { signalManager.disconnectAllSignals(); } catch (e) {}
    }
    signalManager = null;

    extension = null;
}

