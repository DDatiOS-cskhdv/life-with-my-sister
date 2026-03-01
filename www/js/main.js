//=============================================================================
// main.js
//=============================================================================

(() => {
    const startTime = performance.now();
    const endTime = () => `${((performance.now() - startTime) / 1e3).toPrecision(3)}s`;

    let isMobileDevice = () => {
        const isDesktopApp = typeof require === 'function' && typeof process === 'object';
        const isMobile = !isDesktopApp && (
            window.matchMedia?.('(pointer: coarse)')?.matches
            || window.matchMedia?.('(hover: none)')?.matches
            || /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        );

        isMobileDevice = () => isMobile;
        return isMobile;
    };

    // 避免看不到錯誤 只看到黑屏
    if (typeof require === "undefined") window.require = () => {};
    if (typeof process === "undefined") window.process = () => {};

    let scriptReload = (() => {
        const basePath =
            isMobileDevice()
                ? window.cdvUrl
                : (() => {
                    const path = require('path');
                    return path.join(process.cwd(), "www");
                })();

        function joinPath(base, p) {
            if (!base) return p || '';
            if (!p) return base.replace(/\/+$/, '');
            return base.replace(/\/+$/, '') + '/' + p.replace(/^\/+/, '');
        };

        function fileExists(filePath) {
            return new Promise(resolve => {
                if (isMobileDevice()) {
                    if (!filePath) return resolve(false);
                    const url = joinPath(basePath, filePath);
                    window.resolveLocalFileSystemURL(url,
                        () => resolve(true),
                        () => resolve(false)
                    );
                }
                else {
                    const fs = require('fs');
                    const path = require('path');
                    try {
                        if (!path.isAbsolute(filePath))
                            filePath = path.join(basePath, filePath);
                        resolve(fs.existsSync(filePath));
                    } catch (e) {
                        resolve(false);
                    }
                }
            });
        };

        /**
         * @param {Element} script - 錯誤的 script 元素
         * @param {String} src - 載入的 src
         * @param {Number|Undefined} retries - 重載次數
         * @param {Boolean} check - 是否檢查檔案是否存在
         * @returns {Promise} - 重試狀態
         */
        function reTry(script, src, retries = 10, check = true) {
            return new Promise(async (resolve, reject) => {
                if (check && (!await fileExists(src) || !script)) return reject();

                // ? 不採用直接替換 src 的原因是, 無法正確觸發新的 onload 或 onerror 事件
                script.remove(); // 刪除錯誤對象
                script = document.createElement('script'); // 創建一個新的

                // 存在時觸發重載
                Object.assign(script, {
                    src,
                    onload: resolve,
                    onerror() {
                        if (retries <= 0) {
                            script.remove();
                            return reject();
                        }
                        setTimeout(() => {
                            reTry(script, src, retries - 1, false)
                                .then(resolve)
                                .catch(reject)
                        }, 300);
                    }
                })

                document.head.appendChild(script);
            })
        };

        return { reTry };
    })();

    let loadScript = (() => {
        function createScript(src) {
            return new Promise((resolve, reject) => {
                document.head.appendChild(
                    Object.assign(document.createElement('script'), {
                        src,
                        onload: resolve,
                        onerror() {
                            scriptReload.reTry(this, src)
                                .then(resolve)
                                .catch(() => reject(`Error load: ${src}`))
                        }
                    })
                )
            })
        };

        return {
            seq(list) {
                return list.reduce((promise, src) => {
                    return promise.then(() => createScript(src));
                }, Promise.resolve());
            }
        }
    })();

    let init = (() => {
        const pixiList = [
            'js/libs/pixi.js',
            'js/libs/pixi-tilemap.js',
            'js/libs/pixi-picture.js',
        ];
        const otherList = [
            'js/libs/lz-string.js',
            'js/libs/iphone-inline-video.browser.js',
        ];
        const rpgCoreList = [
            'js/rpg_core.js',
            'js/rpg_managers.js',
            'js/rpg_objects.js',
            'js/rpg_scenes.js',
            'js/rpg_sprites.js',
            'js/rpg_windows.js',
            'js/rpg_custom.js',
            'js/plugins.js',
        ];

        /* Android */
        const cordova = 'cordova.js';

        /* PC */
        const openCC = 'js/libs/opencc/full.min.js';

        function loadPlugins() {
            Object.assign(PluginManager, {
                scriptRecord: null,
                setup(plugins) {
                    this.scriptRecord = new Set(this._scripts);

                    if (isMobileDevice()) this._path = window.cdvUrl + this._path;

                    loadScript.seq(
                        plugins.map(plugin => {
                            if (plugin.status && !this.scriptRecord.has(plugin.name)) {
                                this.setParameters(plugin.name, plugin.parameters);
                                this.scriptRecord.add(plugin.name);
                                return this._path + plugin.name + '.js';
                            }
                        }).filter(Boolean)
                    ).then(() => {
                        SceneManager.run(Scene_Boot);
                        console.log('[OK] Init Complete', endTime());
                    }).catch(err => {
                        alert(err);
                    }).finally(() => {
                        this._scripts = [...this.scriptRecord];
                        this.scriptRecord.clear();
                    })
                }
            });

            PluginManager.setup($plugins);
        };

        return {
            ios() {
                function onDeviceReady() {
                    // WKWebView serves www/ via app://localhost/ — file:// URLs are blocked cross-origin.
                    // Use empty cdvUrl so all scripts load via relative paths from the local server.
                    window.cdvUrl = '';
                    console.log('[OK] iOS using relative paths via WKWebView local server');

                    loadScript.seq([...pixiList, ...otherList, ...rpgCoreList])
                        .then(() => {
                            // Force isNwjs()=false on iOS: prevents NW.js code paths in plugins
                            // and makes StorageManager use localStorage instead of fake fs
                            if (typeof Utils !== 'undefined') Utils.isNwjs = function() { return false; };
                            // Patch Decrypter: re-encoded .rpgmvo files have VER=000000 instead of 000301
                            // Fix bytes 9-10 in-place before the header check so decryption succeeds
                            if (typeof Decrypter !== 'undefined') {
                                const _origDecrypt = Decrypter.decryptArrayBuffer.bind(Decrypter);
                                Decrypter.decryptArrayBuffer = function(ab) {
                                    if (ab) {
                                        const v = new Uint8Array(ab);
                                        if (v[0]===0x52&&v[1]===0x50&&v[2]===0x47&&v[3]===0x4d&&v[4]===0x56&&v[9]===0x00&&v[10]===0x00) {
                                            v[9]=0x03; v[10]=0x01;
                                        }
                                    }
                                    return _origDecrypt(ab);
                                };
                            }
                            loadPlugins();
                            console.log('[OK] iOS scripts loaded via seq', endTime());
                        }).catch(err => {
                            alert('[ERR] iOS load error: ' + err);
                        }).finally(() => {
                            scriptReload = null;
                            loadScript = null;
                            init = null;
                        });
                }

                const script = document.createElement('script');
                script.src = cordova;
                script.onload = () => {
                    window.device
                        ? onDeviceReady()
                        : document.addEventListener('deviceready', onDeviceReady, { once: true });
                };
                document.head.appendChild(script);
            },
            android() {
                function onDeviceReady() {
                    const root = window.cordova.file.dataDirectory;
                    if (!root || !window.resolveLocalFileSystemURL) {
                        alert('cordova.file.dataDirectory or resolveLocalFileSystemURL not available');
                        return;
                    }

                    window.resolveLocalFileSystemURL(root, entry => {
                        try {
                            window.cdvUrl = (typeof entry.toInternalURL === 'function') ? entry.toInternalURL() : (entry.nativeURL || root);
                        } catch (e) {
                            window.cdvUrl = entry.nativeURL || root;
                        }

                        // ensure trailing slash
                        if (window.cdvUrl && !window.cdvUrl.endsWith('/')) window.cdvUrl += '/';
                        console.log('Global cdvUrl =', window.cdvUrl);

                        loadScript.seq([
                            ...[
                                ...pixiList,
                                ...otherList,
                                ...rpgCoreList,
                            ].map(path => window.cdvUrl + path)
                        ]).then(() => {
                            loadPlugins();
                            console.log('[OK] Android scripts loaded via seq', endTime());
                        }).catch(err => {
                            alert('[ERR] Android seq load error:', err);
                        }).finally(() => {
                            scriptReload = null;
                            loadScript = null;
                            init = null;
                        })

                    }, err => {
                        alert('Error load FileEntry:', err);
                        scriptReload = null;
                        loadScript = null;
                        init = null;
                    });
                }

                const script = document.createElement('script');
                script.src = cordova;
                script.onload = () => {
                    window.device
                        ? onDeviceReady()
                        : document.addEventListener('deviceready', onDeviceReady, { once: true });
                };
                document.head.appendChild(script);
            },
            // —— Desktop / NW.js —— 
            desktop() {
                loadScript.seq([...pixiList, ...otherList, openCC, ...rpgCoreList])
                    .then(() => {
                        loadPlugins();
                        console.log('[OK] Desktop scripts loaded', endTime());
                    }).catch(err => {
                        alert(err);
                    }).finally(() => {
                        // 釋放閉包 GC
                        scriptReload = null;
                        loadScript = null;
                        init = null;
                    })
            }
        }
    })();

    if (!isMobileDevice()) {
        init.desktop();
    } else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        init.ios();
    } else {
        init.android();
    }
})();