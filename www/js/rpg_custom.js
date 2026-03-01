(() => {
    // 僅判斷 cordova.plugin.http.sendRequest 支援的 protocol
    const protocols = ['http:', 'https:'];

    const hasProtocol = (url) => {
        if (url.startsWith("https://localhost")) return false;

        let protocol;
        for (protocol of protocols)
            if (url.startsWith(protocol)) return true;

        return false;
    };

    const bodyProcess = (body) =>
        (typeof body === 'object' && body !== null && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof ArrayBuffer))
            ? JSON.stringify(body) : body;

    const createMockXHR = (response, type, status, statusText, responseHeaders, responseURL) => {
        const headerObj = responseHeaders instanceof Headers
            ? Object.fromEntries(responseHeaders)
            : (responseHeaders || {});

        return {
            response,
            status,
            statusText,
            responseURL,
            responseText: (type === 'text' || type === 'json') ? (typeof response === 'string' ? response : JSON.stringify(response)) : null,
            responseType: type,
            readyState: 4,
            headers: headerObj,
            getAllResponseHeaders: () => {
                return Object.entries(headerObj).map(([k, v]) => `${k}: ${v}`).join('\r\n');
            },
            getResponseHeader: (name) => {
                return headerObj[Object.keys(headerObj).find(k => k.toLowerCase() === name.toLowerCase())] || null;
            }
        };
    };

    /**
     * @author Canaan HS
     * @description 發送請求的自適應函數
     * @param {String} url - 請求地址
     * @param {Object} options - 設定選項
     * @returns {Promise} - 返回一個帶有 .abort() 方法的 Promise
     * @example
     * httpRequest('https://api.example.com/data', {
     *   responseType: 'json',
     *   headers: { 'Authorization': 'Bearer token' },
     *   onprogress: (xhr, e) => console.log(`下載進度: ${e.loaded}/${e.total}`),
     * }).then(data => {
     *   console.log('取得的資料:', data);
     * }).catch(err => {
     *   console.error('請求失敗:', err);
     * });
     *
     * const req = httpRequest('https://api.example.com/largefile', { responseType: 'blob' });
     * req.abort(); // 取消請求
     */
    window.httpRequest = function (url, options = {}) {
        if (!url) return Promise.reject('Invalid URL');

        let {
            headers = {},           // 請求標頭
            method = 'GET',         // 請求方法
            body = null,            // 允許發送數據 (如 POST)
            timeout = 0,            // 超時時間 0 為不設定
            reTry = 3,              // 失敗重試次數
            useFetch = true,        // 是否使用 Fetch API (不支援會自動切換成 XHR)
            usePluginHttp = true,   // 是否使用插件 HTTP (僅限移動端)
            responseType = "text",  // 期望的回應類型 json, text, blob, arraybuffer...
            progressThrottle = 100, // 進度回調的間隔
            onload, onloadstart, onreadystatechange,
            onprogress, onupprogress, onerror, ontimeout, onloadend, onabort
        } = options || {};

        let requestPromise, abortController = null;

        // ? 移動端有太多情況, 使用 xhr 比較保險
        if (useFetch && (Utils.isMobileDevice() || !window.fetch || onreadystatechange)) useFetch = false;

        requestPromise = new Promise((resolve, reject) => {

            const task = {
                _sendRequest() {
                    const pluginOptions = { method, headers, timeout, responseType };

                    if (body != null) {
                        if (body instanceof FormData) {
                            const obj = {};
                            for (const pair of body.entries()) obj[pair[0]] = pair[1];
                            pluginOptions.data = obj;
                            pluginOptions.serializer = 'multipart';
                        } else if (typeof body === 'object') {
                            pluginOptions.data = body;
                            pluginOptions.serializer = 'json';
                        } else {
                            pluginOptions.data = body;
                            pluginOptions.serializer = 'utf8';
                        }
                    }

                    if (onloadstart) onloadstart(new Event('loadstart'));

                    cordova.plugin.http.sendRequest(url, pluginOptions,
                        function (response) {
                            let data = response.data;

                            if (responseType === 'json' && typeof data === 'string') {
                                try { data = JSON.parse(data); } catch (e) { }
                            }
                            else if (responseType === 'arraybuffer') {
                                if (typeof data === 'string') {
                                    const base64String = data.replace(/^data:.*?;base64,/, '');
                                    const binaryString = atob(base64String);
                                    const bytes = new Uint8Array(binaryString.length);
                                    for (let i = 0; i < binaryString.length; i++) {
                                        bytes[i] = binaryString.charCodeAt(i);
                                    }
                                    data = bytes.buffer;
                                }
                            }

                            const mockXHR = createMockXHR(
                                data,
                                responseType,
                                response.status,
                                "OK",
                                response.headers,
                                response.url || url
                            );

                            onload?.(mockXHR);
                            onloadend?.(new Event('loadend'), mockXHR);
                            resolve(data);
                        },
                        function (response) {
                            if (method === 'GET' && reTry-- > 0) {
                                setTimeout(task._sendRequest, 2e3 / reTry);
                                return;
                            };

                            const err = new Error(response.error || 'Cordova HTTP Error');
                            const errXHR = createMockXHR(
                                response.error,
                                responseType,
                                response.status || 0,
                                response.error,
                                response.headers || {},
                                url
                            );

                            onerror?.(err, errXHR);
                            onloadend?.(new Event('loadend'), errXHR);
                            reject(err);
                        }
                    )
                },
                async _fetch() {
                    const controller = new AbortController();
                    abortController = controller;
                    const signal = controller.signal;

                    let timeoutId;
                    if (timeout > 0) {
                        timeoutId = setTimeout(() => {
                            controller.abort();
                            ontimeout?.(new Event('timeout'));
                            reject('Timeout');
                        }, timeout);
                    }

                    try {
                        onloadstart?.(new Event('loadstart'));

                        const response = await fetch(url, {
                            method,
                            headers,
                            body: bodyProcess(body),
                            signal
                        });

                        if (timeoutId) clearTimeout(timeoutId);

                        if (!response.ok) {
                            if (method === 'GET' && reTry-- > 0) {
                                setTimeout(task._fetch, 2e3 / reTry);
                                return;
                            };

                            const errObj = {
                                status: response.status,
                                statusText: response.statusText,
                                response
                            };

                            onerror?.(errObj);
                            onloadend?.(new Event('loadend'));
                            return reject(errObj);
                        }

                        let result;
                        if (onprogress && response.body) {
                            const reader = response.body.getReader();
                            const contentLength = +response.headers.get('Content-Length') || 0;
                            const lengthComputable = contentLength > 0;
                            let receivedLength = 0;
                            let chunks = [];
                            let lastProgressTime = 0;

                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                chunks.push(value);
                                receivedLength += value.length;

                                const now = Date.now();
                                if (now - lastProgressTime >= progressThrottle) {
                                    lastProgressTime = now;
                                    onprogress({
                                        loaded: receivedLength,
                                        total: contentLength,
                                        lengthComputable
                                    })
                                }
                            }

                            const chunksAll = new Uint8Array(receivedLength);
                            let position = 0;
                            for (let chunk of chunks) {
                                chunksAll.set(chunk, position);
                                position += chunk.length;
                            }

                            if (responseType === 'json') {
                                result = JSON.parse(new TextDecoder("utf-8").decode(chunksAll));
                            } else if (responseType === 'text') {
                                result = new TextDecoder("utf-8").decode(chunksAll);
                            } else if (responseType === 'blob') {
                                result = new Blob([chunksAll]);
                            } else if (responseType === 'arraybuffer') {
                                result = chunksAll.buffer;
                            } else {
                                result = new TextDecoder("utf-8").decode(chunksAll);
                            }
                        } else {
                            result = await {
                                'json': async () => await response.json(),
                                'text': async () => await response.text(),
                                'blob': async () => await response.blob(),
                                'arraybuffer': async () => await response.arrayBuffer()
                            }[responseType]();
                        }

                        const mockXHR = createMockXHR(
                            result,
                            responseType,
                            response.status,
                            response.statusText,
                            response.headers,
                            response.url
                        );

                        onload?.(mockXHR);
                        onloadend?.(new Event('loadend'), mockXHR);
                        resolve(result);
                    } catch (err) {
                        err.name === 'AbortError'
                            ? onabort?.(new Event('abort'))
                            : onerror?.(err);

                        onloadend?.(new Event('loadend'));
                        reject(err);
                    }
                },
                _xhr() {
                    const xhr = new XMLHttpRequest();
                    abortController = xhr;

                    xhr.open(method, url);
                    xhr.responseType = responseType;
                    if (timeout > 0) xhr.timeout = timeout;

                    for (const [key, value] of Object.entries(headers)) {
                        xhr.setRequestHeader(key, value);
                    }

                    if (onloadstart) xhr.onloadstart = onloadstart;
                    if (onprogress || onupprogress) {
                        const progress = onprogress
                            ? [xhr.onprogress, onprogress]
                            : [xhr.upload.onprogress, onupprogress];

                        let lastTime = 0;
                        progress[0] = e => {
                            const now = Date.now();
                            if (now - lastTime >= progressThrottle) {
                                lastTime = now;
                                progress[1](e, xhr);
                            }
                        }
                    }

                    if (onabort) xhr.onabort = onabort;
                    if (ontimeout) xhr.ontimeout = ontimeout;
                    if (onerror) xhr.onerror = onerror;
                    if (onloadend) xhr.onloadend = onloadend;
                    if (onreadystatechange) xhr.onreadystatechange = onreadystatechange;

                    xhr.onload = () => {
                        if (onload) onload(xhr);
                        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
                            resolve(xhr.response);
                        } else {
                            if (method === 'GET' && reTry-- > 0) {
                                setTimeout(task._xhr, 2e3 / reTry);
                                return;
                            };

                            reject({ status: xhr.status, statusText: xhr.statusText, xhr });
                        }
                    };

                    try {
                        xhr.send(bodyProcess(body));
                    } catch (err) {
                        reject(err);
                    }
                }
            };

            if (
                Utils.isMobileDevice() && usePluginHttp && hasProtocol(url) && window?.cordova?.plugin?.http
            ) task._sendRequest();
            else if (useFetch) task._fetch();
            else task._xhr();
        });

        requestPromise.abort = () => {
            if (abortController) {
                if (
                    abortController instanceof XMLHttpRequest
                    || abortController instanceof AbortController
                ) {
                    abortController.abort();
                } else {
                    console.warn('Abort not supported');
                }
            }
        };

        return requestPromise;
    };
})();

(() => {
    // 手机版补丁
    if (!Utils.isMobileDevice()) return;

    // ========== rpg_core.js ==========

    Bitmap.prototype._requestImage = function (url) {
        if (Bitmap._reuseImages.length !== 0) {
            this._image = Bitmap._reuseImages.pop();
        } else { this._image = new Image(); }
        if (this._decodeAfterRequest && !this._loader) {
            this._loader = ResourceHandler.createLoader(
                url,
                this._requestImage.bind(this, url),
                this._onError.bind(this)
            );
        }
        this._url = url;
        this._loadingState = 'requesting';

        // ===== check for image encryption =====
        if (!Decrypter.checkImgIgnore(url) && Decrypter.hasEncryptedImages) {
            this._loadingState = 'decrypting';
            Decrypter.decryptImg(url, this);
            return;
        }

        // ===== use of unencrypted images =====
        var dataBase = window.cdvUrl || "";
        if (dataBase && !dataBase.endsWith("/")) dataBase += "/";
        var dataFull = dataBase + url;
        var originalLoad = function () {
            this._image.src = url;
            this._image.addEventListener(
                'load',
                this._loadListener = Bitmap.prototype._onLoad.bind(this)
            );
            this._image.addEventListener(
                'error',
                this._errorListener = this._loader || Bitmap.prototype._onError.bind(this)
            );
        }.bind(this);
        var tryLocal = function (path, onSuccess, onFail) {
            window.resolveLocalFileSystemURL(
                path,
                function (entry) {
                    entry.file(function (file) {
                        var reader = new FileReader();
                        reader.onload = function () {
                            //console.log('[Bitmap] Loaded from dataDirectory:', path);
                            var blob = new Blob([reader.result]);
                            this._image.src = URL.createObjectURL(blob);
                            this._image.addEventListener(
                                'load',
                                this._loadListener = Bitmap.prototype._onLoad.bind(this)
                            );
                            this._image.addEventListener(
                                'error',
                                this._errorListener = this._loader || Bitmap.prototype._onError.bind(this)
                            );
                        }.bind(this);
                        reader.onerror = onFail;
                        reader.readAsArrayBuffer(file);
                    }.bind(this), onFail);
                }.bind(this),
                onFail
            );
        }.bind(this);
        tryLocal(
            dataFull,
            function () {
            },
            originalLoad
        );
    };

    // ========== rpg_managers.js ==========

    if (typeof AndroidSave !== 'undefined') {
        Object.assign(StorageManager, {
            loadFromWebStorage(savefileId) {
                var data = null;
                var filePath = this.localFilePath(savefileId);
                data = AndroidSave.loadSave(filePath);
                return data;
            },
            saveToWebStorage(savefileId, json) {
                var filePath = this.localFilePath(savefileId);
                AndroidSave.saveGame(filePath, json);
            },
            removeWebStorage(savefileId) {
                var filePath = this.localFilePath(savefileId);
                AndroidSave.removeSave(filePath);
            },
            webStorageExists(savefileId) {
                var fileName = this.localFilePath(savefileId);
                return AndroidSave.loadSaveExists(fileName);
            },
            localFilePath(savefileId) {
                let name;
                if (savefileId < 0) {
                    name = 'config.rpgsave';
                } else if (savefileId === 0) {
                    name = 'global.rpgsave';
                } else {
                    name = 'file%1.rpgsave'.format(savefileId);
                }
                return name;
            }
        })
    }
})();

(() => {
    // ========== 安卓適配 補丁 ==========

    // 適配安卓網址頭
    window.universalUrl = Utils.isMobileDevice() && window.cdvUrl
        ? window.cdvUrl.replace(/\/?$/, '/') : "";

    // 安卓人請求
    function loadFromLocalFile(path, onSuccess, onFail) {
        if (!universalUrl) {
            onFail();
            return;
        };

        window.resolveLocalFileSystemURL(
            universalUrl + path,
            (entry) => {
                entry.file((file) => {
                    const reader = new FileReader();
                    reader.onload = () => onSuccess(reader.result);
                    reader.onerror = onFail;
                    reader.readAsArrayBuffer(file);
                }, onFail);
            },
            onFail
        )
    };

    // ========== rpg_core.js ==========

    WebAudio.prototype._load = function (url) {
        if (!WebAudio._context) return;
        if (Decrypter.hasEncryptedAudio) url = Decrypter.extToEncryptExt(url);

        loadFromLocalFile(
            url,
            response => this._onXhrLoad({ response }),
            () => httpRequest(url, {
                responseType: 'arraybuffer',
                onload: (xhr) => {
                    if (xhr.status < 400) {
                        this._onXhrLoad(xhr);
                    }
                },
                onerror: this._loader || (() => { this._hasError = true; })
            })
        )
    };

    Object.assign(Decrypter, {
        decryptImg(url, bitmap) {
            url = this.extToEncryptExt(url);

            const addBitmap = (response) => {
                const arrayBuffer = Decrypter.decryptArrayBuffer(response);
                bitmap._image.src = Decrypter.createBlobUrl(arrayBuffer);
                bitmap._image.addEventListener('load', bitmap._loadListener = Bitmap.prototype._onLoad.bind(bitmap));
                bitmap._image.addEventListener('error', bitmap._errorListener = bitmap._loader || Bitmap.prototype._onError.bind(bitmap));
            };

            loadFromLocalFile(
                url,
                response => addBitmap(response),
                () => httpRequest(url, {
                    responseType: 'arraybuffer',
                    onload: (requestFile) => {
                        if (requestFile.status < Decrypter._xhrOk) addBitmap(requestFile.response)
                    },
                    onerror() {
                        bitmap._loader ? bitmap._loader() : bitmap._onError();
                    }
                })
            )
        },
        decryptHTML5Audio(url, bgm, pos) {
            httpRequest(url, {
                responseType: 'arraybuffer',
                onload: (requestFile) => {
                    if (requestFile.status < Decrypter._xhrOk) {
                        const arrayBuffer = Decrypter.decryptArrayBuffer(requestFile.response);
                        const url = Decrypter.createBlobUrl(arrayBuffer);
                        AudioManager.createDecryptBuffer(url, bgm, pos);
                    }
                }
            })
        }
    });

    // ========== rpg_managers.js ==========

    const originalPop = SceneManager.pop;

    window.switchTestMode = function () {
        const url = new URL(location);
        url.searchParams.has("test")
            ? url.searchParams.delete("test")
            : url.search = "test";
        history.replaceState(null, null, url.href);
        console.log("TestMode:", Utils.isOptionValid("test"));
    };

    Object.defineProperty(window, 'checkModify', {
        get() {
            return Utils.isOptionValid("test")
                ? false : originalPop !== SceneManager.pop;
        }
    });

    let getVersion = () => {
        let ver = "";
        // 1) 从 System 标题里解析 “verX.X.X”
        if ($dataSystem && $dataSystem.gameTitle) {
            const m = $dataSystem.gameTitle.match(/ver\s*([A-Za-z0-9._-]+)/i);
            if (m) ver = m[1];
        };

        // 2) 兜底：从 document.title 里再试一次
        if (!ver && document.title) {
            const m2 = document.title.match(/ver\s*([A-Za-z0-9._-]+)/i);
            if (m2) ver = m2[1];
        };

        // 设备标记
        const suffix = (window.Utils && Utils.isMobileDevice())
            ? (Utils.isMobileSafari() ? " (iOS)" : " (Android)")
            : "";
        const result = `Current Version: ${ver || ""}${suffix}`;

        getVersion = () => result;
        return result;
    };

    Object.assign(Graphics, {
        backupPrintError: Graphics.printError, // 避免被覆蓋
        _makeErrorHtml(name = "UnknownError", error = {}) {

            // 合并 stack 与 message
            const rawStack = error?.stack || "";
            const rawMessage = error?.message || "";
            // 測試模式不上報
            if (!window.checkModify && !Utils.isOptionValid("test") && navigator.onLine && appScript && window.DISABLE_AUTO_UPDATE !== true) {
                let combined = `${rawMessage}\n${rawStack}`;

                // 截断超长文本，避免单元格超限
                const max = 2000;
                if (combined.length > max) combined = combined.slice(0, max) + "\n...[truncated]";

                let mapId;
                if ($gameMap && $gameMap.mapId) {
                    const gmID = $gameMap.mapId?.();
                    mapId = gmID || gmID === 0
                        ? gmID : "Unknown";
                };
                const payload = {
                    version: getVersion(),
                    errorType: `
                        ${name}
                        mapId: ${mapId}
                        language: ${ConfigManager.language != null ? ConfigManager.language : "unknown"}
                        isMobile: ${Utils.isMobileDevice()}
						versionId: ${$dataSystem.versionId}
                    `.replace(/^\s+/gm, ''),
                    stack: combined
                };

                // 自动上传错误报告到服务器上
                httpRequest(appScript, {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json' },
                    body: payload
                });

                
            };
            if (window.checkModify) setTimeout(QJ.MPMZ.tl.gameDataModificationWarning, 500);
            return `
                <h1 style="color: yellow;">${name}</h1>
                <h1 style="color: white; margin: 8px 0;">${getVersion()}</h1>
                <pre style="color: white;">${rawMessage}\n\n${rawStack}</pre>
            `;
        }
    });
    window.DISABLE_AUTO_UPDATE = true;

    const __ls_mem__ = {};
    let __ls_ok__ = true;
    try {
        const k = "__rmmz_test__";
        localStorage.setItem(k, "1");
        localStorage.removeItem(k);
    } catch (e) {
        __ls_ok__ = false;
    }
    function __ls_get__(k) {
        if (__ls_ok__) return localStorage.getItem(k);
        return Object.prototype.hasOwnProperty.call(__ls_mem__, k) ? __ls_mem__[k] : null;
    }
    function __ls_set__(k, v) {
        if (__ls_ok__) {
            try { localStorage.setItem(k, v); return; } catch (e) {}
        }
        __ls_mem__[k] = v;
    }
    function __ls_rm__(k) {
        if (__ls_ok__) {
            try { localStorage.removeItem(k); return; } catch (e) {}
        }
        delete __ls_mem__[k];
    }
    Object.assign(StorageManager, {
        saveToWebStorage(savefileId, json) {
            const key = this.webStorageKey(savefileId);
            const data = LZString.compressToBase64(json);
            __ls_set__(key, data);
        },
        loadFromWebStorage(savefileId) {
            const key = this.webStorageKey(savefileId);
            const data = __ls_get__(key);
            return LZString.decompressFromBase64(data);
        },
        webStorageExists(savefileId) {
            const key = this.webStorageKey(savefileId);
            return !!__ls_get__(key);
        },
        webStorageBackupExists(savefileId) {
            const key = this.webStorageKey(savefileId) + "bak";
            return !!__ls_get__(key);
        },
        removeWebStorage(savefileId) {
            const key = this.webStorageKey(savefileId);
            __ls_rm__(key);
        },
        backup(savefileId) {
            if (this.exists(savefileId)) {
                if (this.isLocalMode()) {
                    const data = this.loadFromLocalFile(savefileId);
                    const compressed = LZString.compressToBase64(data);
                    const fs = require('fs');
                    const dirPath = this.localFileDirectoryPath();
                    const filePath = this.localFilePath(savefileId) + ".bak";
                    if (!fs.existsSync(dirPath)) {
                        fs.mkdirSync(dirPath);
                    }
                    fs.writeFileSync(filePath, compressed);
                } else {
                    const data = this.loadFromWebStorage(savefileId);
                    const compressed = LZString.compressToBase64(data);
                    const key = this.webStorageKey(savefileId) + "bak";
                    __ls_set__(key, compressed);
                }
            }
        },
        cleanBackup(savefileId) {
            if (this.backupExists(savefileId)) {
                if (this.isLocalMode()) {
                    const fs = require('fs');
                    const dirPath = this.localFileDirectoryPath();
                    const filePath = this.localFilePath(savefileId);
                    fs.unlinkSync(filePath + ".bak");
                } else {
                    const key = this.webStorageKey(savefileId);
                    __ls_rm__(key + "bak");
                }
            }
        }
    });

    let gcWork = null;
    Object.assign(SceneManager, {
        // 避免報錯中止音頻播放
        onError(e) {
            console.trace(e.message);
            try {
                this.stop();
                Graphics.backupPrintError.call(Graphics, 'Error', e);
            } catch (e2) {
                console.trace(e2);
                Graphics.backupPrintError.call(Graphics, 'UnknownError', e2);
            }
        },
        catchException(e) {
            if (e instanceof Error) {
                Graphics.backupPrintError.call(Graphics, e.name, e);
                console.error(e.stack);
            } else {
                Graphics.backupPrintError.call(Graphics, 'UnknownError', e);
            }
            this.stop();
        },
        // 場景切換自動清理 GC
        changeScene() {
            if (this.isSceneChanging() && !this.isCurrentSceneBusy()) {
                if (this._scene) {
                    this._scene.terminate();
                    this._scene.detachReservation();
                    this._previousClass = this._scene.constructor;
                }

                const differentScene = this._scene && this._scene !== this._nextScene;
                this._scene = this._nextScene;
                if (this._scene) {
                    this._scene.attachReservation();
                    this._scene.create();
                    this._nextScene = null;
                    this._sceneStarted = false;
                    this.onSceneCreate();

                    if (differentScene) {
                        cancelIdleCallback(gcWork);
                        gcWork = requestIdleCallback(() => {
                            Graphics.callGC();
                        }, { timeout: 1e4 });
                    }
                }
                if (this._exiting) {
                    this.terminate();
                }
            }
        },
        // 原生調用 異步的 canReadGameFiles 檢查, 始終都是 true, 沒意義的檢查
        checkFileAccess() { }
    });

    Object.assign(DataManager, {
        loadDataFile(name, src) {
            const url = universalUrl + 'data/' + src;

            httpRequest(url, {
                responseType: 'json',
                onloadstart() {
                    window[name] = null;
                },
                onerror: this._mapLoader || function () {
                    DataManager._errorUrl = DataManager._errorUrl || url;
                }
            }).then(data => {
                window[name] = data;
                DataManager.onLoad(window[name]);
            })
        },
        loadMapData(mapId) {
            if (mapId > 0) {
                const filename = 'Map%1.json'.format(mapId.padZero(3));
                this._mapLoader = ResourceHandler.createLoader(
                    universalUrl + 'data/' + filename,
                    this.loadDataFile.bind(this, '$dataMap', filename)
                );
                this.loadDataFile('$dataMap', filename);
            } else {
                this.makeEmptyMap();
            }
        }
    })

    // ========== rpg_objects.js ==========

    Game_Battler.prototype.isStateAddable = function (stateId) {
        // ! this._result.isStateRemoved(stateId)  移除了当前回合不允许重复附加状态的限制
        return (this.isAlive() && $dataStates[stateId] &&
            !this.isStateResist(stateId) &&
            !this.isStateRestrict(stateId));
    };

    const old_initMembers = Game_Actor.prototype.initMembers;
    Object.assign(Game_Actor.prototype, {
        initMembers() {
            old_initMembers.call(this);
            this._weaponAmountLimit = 10;  // 武器携带上限
            this._armorAmountLimit = 20;  // 装备携带上限
            this._weaponAmountBonus = 0;  // 额外武器携带上限
            this._armorAmountBonus = 20;  // 额外装备携带上限
        },
        // 修改了脱下装备的逻辑
        discardEquip(item) {
            const slotId = this.equips().indexOf(item);
            if (slotId >= 0) {
                if (DataManager.isWeapon(item)) {
                    this.changeEquip(slotId, $dataWeapons[4]);
                } else if (DataManager.isArmor(item)) {
                    this.changeEquip(slotId, null);
                }
            }
        },
        // 原生的步数刷新状态回合
        onPlayerWalk() {
            this.clearResult();
            this.checkFloorEffect();
            if ($gamePlayer.isNormal()) {
                this.states().forEach(function (state) {
                    this.updateStateSteps(state);
                }, this);
                this.showAddedStates();
                this.showRemovedStates();
            }
        },
        // 步数刷新回合
        stepsForTurn() {
            return 1000;
        }
    });

    // 修改了game over判定
    Game_Unit.prototype.isAllDead = function () {
        return $gameActors.actor(1).isStateAffected(1);
    };

    Object.assign(Game_Map.prototype, {
        // 检查玩家有没有受困
        checkPlayerIsPassable() {
            const x = Math.floor($gamePlayer.centerRealX());
            const y = Math.floor($gamePlayer.centerRealY());

            return this.isPassable(x, y, 2) || // 下
                this.isPassable(x, y, 4) || // 左
                this.isPassable(x, y, 6) || // 右
                this.isPassable(x, y, 8);   // 上
        },
        //新增方法，主要用于重置演出事件
        resetMapeventSequence() {
            // 出于防范，重置玩家Z轴高度	
            $gamePlayer.mppHidPasZ = 0;
            // 出于防范，重置玩家举物状态
            $gamePlayer.drill_PT_clearLifting();
            // 出于防范，恢复玩家鼠标操作权限
            $gameSystem._drill_COI_map_mouse = true;
            // 出于防范，重置玩家行走图和移动权限
            $gamePlayer.drill_EASA_setEnabled(true);
            $gameSystem._drill_PAlM_enabled = true;

            // 非特定情况，淡出当前地图bgm
            if (!$gameSwitches.value(40)) {
                AudioManager.fadeOutBgm(2);
            }
            $gameSwitches.setValue(40, false);

            // 淡出可能存在的篝火音效
            if (AudioManager._allBgsBuffer && AudioManager._allBgsBuffer[12]) {
                AudioManager._allBgsBuffer[12].fadeOut(1);
            }
            // 清除旋风斩音效
            if (AudioManager._allBgsBuffer && AudioManager._allBgsBuffer[9]) {
                AudioManager.stopBgsByLine(9);
            }

            // 重置事件开关
            this._events.forEach(function (event) {
                if (event && event.event().note && (event.event().note.includes('<重置独立开关>') || event.event().note.includes('<resetSelfSwitch>'))) {
                    const eventId = event.eventId();
                    $gameSelfSwitches.setValue([this._mapId, eventId, 'A'], false);
                    $gameSelfSwitches.setValue([this._mapId, eventId, 'B'], false);
                    $gameSelfSwitches.setValue([this._mapId, eventId, 'C'], false);
                    $gameSelfSwitches.setValue([this._mapId, eventId, 'D'], false);
                }
            }, this);

            // 清除图片资源
            const maxPictures = 90;
            for (let pictureId = 3; pictureId <= maxPictures; pictureId++) {
                let picture = $gameScreen.picture(pictureId);
                if (picture) {
                    picture.drill_PCE_stopEffect();
                    $gameScreen.erasePicture(pictureId);
                }
            }

            // 清除图片点击判定
            $gameScreen._pictureCidArray = [];
            $gameScreen._pictureSidArray = [];
            $gameScreen._picturePidArray = [];
            $gameScreen._pictureTransparentArray = [];

            // 清除图片缓存
            // chahuiUtil.freePictureSubdirCache({ ignoreReservation:true, verbose:true });	
        }
    });

    Game_CharacterBase.prototype.animationWait = function () {
        // 新的速度范围是1到64，我们要找到一个新的基准值
        const baseSpeed = 64; // 最大速度
        const speed = this.realMoveSpeed();
        const maxWait = 24; // 原来的最慢速度对应的等待时间
        const minWait = 3; // 原来的最快速度对应的等待时间

        // 由于速度范围变化，我们需要重新计算等待时间的范围
        // 我们假设等待时间与速度成反比
        // 当速度最小时，等待时间最大；速度最大时，等待时间最小
        const waitTime = ((baseSpeed - speed) / (baseSpeed - 1)) * (maxWait - minWait) + minWait;

        return waitTime;
    };

    Object.assign(Game_Player.prototype, {
        // 修改了遇敌事件
        executeEncounter() {
            if (!$gameMap.isEventRunning() && this._encounterCount <= 0) {
                this.makeEncounterCount();
                const commonEventId = this.makeEncounterTroopId() + 299;
                if ($dataCommonEvents[commonEventId] && $dataCommonEvents[commonEventId].name) {
                    $gameTemp.reserveCommonEvent(commonEventId);
                    return false;
                }
            }
            return false;
        },
        // 增加了耐力消耗
        updateDashing() {
            if (this.isMoving()) {
                return;
            }
            if (!this._isPushing && this.canMove() && !this.isInVehicle() && !$gameMap.isDashDisabled()) {
                this._dashing = ConfigManager.alwaysDash || $gameTemp.isDestinationValid();
            } else {
                this._dashing = false;
            }
        }
    });

    Object.assign(Game_Interpreter.prototype, {
		fadeSpeed() {
			return 16;
		},
        videoFileExt() {
            if (Graphics.canPlayVideoType('video/webm') && !Utils.isMobileDevice()) {
                return '.webm';
            } else {
                return '.mp4';
            }
        },
        // 避免 class 內嚴格環境下, 解析失敗
        command355() {
            let script = this.currentCommand().parameters[0] + '\n';
            while (this.nextEventCode() === 655) {
                this._index++;
                script += this.currentCommand().parameters[0] + '\n';
            }
            eval(script);
            return true;
        }
    });

    // ========== rpg_scenes.js ==========

    const old_commandNewGame = Scene_Title.prototype.commandNewGame
    Scene_Title.prototype.commandNewGame = function () {
        const audio = {}
        audio.name = '風鈴の音'
        audio.volume = 90
        audio.pitch = 100
        AudioManager.playSe(audio);
        old_commandNewGame.call(this);
    };

    const superclass = Scene_Base.prototype;
    Object.assign(Scene_Map.prototype, {
        // 屏蔽了长按加速功能
        updateMainMultiply() {
            this.updateMain();
        },
        // 修改了地图界面中忙碌状态的判定
        isBusy() {
            if (this._itemWindow) {
                return this._waitCount > 0 || this._encounterEffectDuration > 0 ||
                    superclass.isBusy.call(this);
            } else {
                return ((this._messageWindow && this._messageWindow.isClosing()) ||
                    this._waitCount > 0 || this._encounterEffectDuration > 0 ||
                    superclass.isBusy.call(this));
            }
        },
        terminate() {
            superclass.terminate.call(this);
            if (!SceneManager.isNextScene(Scene_Battle)) {
                this._spriteset.update();
                this._mapNameWindow.hide();
                SceneManager.snapForBackground();
            } else {
                ImageManager.clearRequest();
            }

            if (SceneManager.isNextScene(Scene_Map)) {
                // 新增方法，主要用于重置演出事件
                $gameMap.resetMapeventSequence();
                ImageManager.clearRequest();
            }

            $gameScreen.clearZoom();

            this.removeChild(this._fadeSprite);
            this.removeChild(this._mapNameWindow);
            this.removeChild(this._windowLayer);
            this.removeChild(this._spriteset);
        },
        // 取消鼠标右键打开菜单的功能
        updateCallMenu() {
            if (this.isMenuEnabled()) {
                if (this.menuCalling && !$gamePlayer.isMoving()) {
                    this.callMenu();
                }
            } else {
                this.menuCalling = false;
            }
        }
    });

    // 追加了选项窗口透明度为0
    Scene_Options.prototype.createOptionsWindow = function () {
        this._optionsWindow = new Window_Options();
        this._optionsWindow.setHandler('cancel', this.popScene.bind(this));
        this._optionsWindow.opacity = 0;
        this.addWindow(this._optionsWindow);
    };

    // ========== rpg_windows.js ==========

    // 图标尺寸
    Object.assign(Window_Base, {
        _iconWidth: 64,
        _iconHeight: 64
    });

    Object.assign(Window_Base.prototype, {
        // 竖排版函数
        drawVerticalText(text, x, y) {
            let lineHeight = this.contents.fontSize;
            let characters = text.split('');

            for (let i = 0; i < characters.length; i++) {
                let character = characters[i];
                this.drawText(character, x, y + i * lineHeight);
            }
        },
        // 转义符绘制图标
        processDrawIcon(iconIndex, textState) {
            this.drawIcon(iconIndex, textState.x + 2, textState.y - 2);
            textState.x += Window_Base._iconWidth + 4;
        },
        // 绘制图标的函数
        drawIcon(iconIndex, x, y) {
            const bitmap = ImageManager.loadSystem('IconSet_large');
            const pw = Window_Base._iconWidth;
            const ph = Window_Base._iconHeight;
            const sx = iconIndex % 16 * pw;
            const sy = Math.floor(iconIndex / 16) * ph;
            this.contents.blt(bitmap, sx, sy, pw, ph, x, y);
        },
    });

    Object.assign(Window_Message.prototype, {
        // 取消了快进会导致等待帧转义字符失效的效果
        updateMessage() {
            if (this._textState) {
                while (!this.isEndOfText(this._textState)) {
                    if (this.needsNewPage(this._textState)) {
                        this.newPage(this._textState);
                    }
                    this.updateShowFast();
                    this.processCharacter(this._textState);
                    // 先看等待/暂停
                    if (this.pause || this._waitCount > 0) {
                        break;
                    }
                    // 再看是否要继续快进
                    if (!this._showFast && !this._lineShowFast) {
                        break;
                    }
                }
                if (this.isEndOfText(this._textState)) {
                    this.onEndOfText();
                }
                return true;
            } else {
                return false;
            }
        },
        // 鼠标长按状态下加速等待帧计时
        updateWait() {
            if (this._waitCount > 0) {
                // 追加单击时无视等待指令
                if (TouchInput.isTriggered()) this._waitCount = 5;
                this._waitCount -= TouchInput.isPressed() ? 2 : 1;
                return true;
            } else {
                return false;
            }
        },
    });

    // 文本描述栏默认宽度和行数
    Window_Help.prototype.initialize = function (numLines) {
        const width = Graphics.boxWidth;
        const height = this.fittingHeight(numLines || 4);
        Window_Base.prototype.initialize.call(this, 0, 0, width, height);
        this._text = '';
    };

    // 读取玩家选中道具的ID，控制台用
    Window_ItemList.prototype.printItemId = function () {
        const item = this.item();
        if (item) {
            console.log('Selected item ID:', item.id);
        }
    };

    // 阻止修改技能名称、图标的透明度修改
    Window_SkillList.prototype.drawItem = function (index) {
        const skill = this._data[index];
        if (skill) {
            const costWidth = this.costWidth();
            const rect = this.itemRect(index);
            rect.width -= this.textPadding();
            this.drawItemName(skill, rect.x, rect.y, rect.width - costWidth);
            this.drawSkillCost(skill, rect.x, rect.y, rect.width);
            this.changePaintOpacity(1);
        }
    };

    Object.assign(Window_Options.prototype, {
        // 始终冲刺、记住指令功能
        addGeneralOptions() { },
        // BGM、BGS、ME、SE控制
        addVolumeOptions() {
            this.addCommand(TextManager.bgmVolume, 'bgmVolume');
            this.addCommand(TextManager.bgsVolume, 'bgsVolume');
            this.addCommand(TextManager.seVolume, 'seVolume');
        }
    });

    Window_ChoiceList.prototype.select = function (index) {
        Window_Command.prototype.select.call(this, index);
        this._eventRan = false;
    };
	
	Window_TitleCommand.prototype.isContinueEnabled = function() {
		return true;
	};
})();

(() => {
    /**
     * @author Canaan HS
     * @description 自訂提示窗口
     */

    const add = (() => {
        const addRecord = new Map();
        function addHead(type, rule, id = crypto.randomUUID(), repeatAdd = true) {
            let element = addRecord.get(id);

            if (!repeatAdd && element) return;
            if (!element) {
                element = document.createElement(type);
                element.id = id;
                document.head.appendChild(element);
            };

            element.textContent += rule;
            addRecord.set(id, element);
        };

        return {
            style: (rule, id, repeatAdd) => addHead("style", rule, id, repeatAdd),
            script: (rule, id, repeatAdd) => addHead("script", rule, id, repeatAdd),
        }
    })();

    const dialogStyle = `
        .dialog-overlay {
            position: fixed;
            inset: 0;
            background: rgba(20, 15, 20, 0.75);
            display: grid;
            place-items: center;
            z-index: 10000;
            backdrop-filter: blur(3px);
            padding: clamp(12px, 4vw, 60px);
            box-sizing: border-box;
        }

        /* 動畫效果類 */
        .dialog-overlay.animated-fade { animation: fadeIn 0.4s ease-out; }
        .dialog-overlay.animated-fade.closing { animation: fadeOut 0.35s ease-out forwards; }
        .dialog-overlay.no-animation { opacity: 1; }

        .dialog {
            background: linear-gradient(135deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.28) 22%, rgba(0,0,0,.48) 50%, rgba(0,0,0,.28) 78%);
            border-radius: clamp(12px, 3vw, 18px);
            padding: 3px;
            width: fit-content;
            min-width: min(clamp(280px, 90vw, var(--dialog-width)), 95vw);
            max-width: 95vw;
            max-height: clamp(400px, 85vh, 90vh);
            box-shadow: 
                0 0 25px rgba(50, 50, 50, 0.2), 
                0 0 50px rgba(75, 75, 75, 0.15), 
                0 12px 35px rgba(0, 0, 0, 0.4);
            position: relative;
            overflow: hidden;
            box-sizing: border-box;
            font-family: 
                'Segoe UI Variable', 'Segoe UI', system-ui,
                -apple-system, BlinkMacSystemFont,
                'Roboto', 'Helvetica Neue', 'Arial',
                'Microsoft YaHei', '微软雅黑',
                'Microsoft JhengHei', '微軟正黑體',
                'PingFang SC', 'PingFang TC',
                'Hiragino Sans GB', 'Hiragino Kaku Gothic Pro',
                'Noto Sans CJK SC', 'Noto Sans CJK TC', 
                'Source Han Sans SC', 'Source Han Sans TC',
                'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo',
                sans-serif,
                'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji';
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
            font-feature-settings: 'kern' 1;
            font-kerning: normal;
        }

        @media screen and (-webkit-min-device-pixel-ratio: 0) {
            @supports not (-webkit-touch-callout: none) {
                .dialog-title { font-weight: 700; }
                .dialog-message { font-weight: 550; }
                .dialog-button { font-weight: 600; }
            }
        }

        /* 對話框動畫 */
        .dialog.animated-fade { animation: dialogFadeIn 0.4s ease-out; }
        .dialog.animated-fade.closing { animation: dialogFadeOut 0.35s ease-out forwards; }
        .dialog.animated-slide-top { animation: slideFromTop 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        .dialog.animated-slide-top.closing { animation: slideToTop 0.35s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards; }
        .dialog.animated-slide-bottom { animation: slideFromBottom 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        .dialog.animated-slide-bottom.closing { animation: slideToBottom 0.35s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards; }
        .dialog.animated-slide-left { animation: slideFromLeft 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        .dialog.animated-slide-left.closing { animation: slideToLeft 0.35s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards; }
        .dialog.animated-slide-right { animation: slideFromRight 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        .dialog.animated-slide-right.closing { animation: slideToRight 0.35s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards; }
        .dialog.animated-scale { animation: scaleIn 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .dialog.animated-scale.closing { animation: scaleOut 0.35s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards; }
        .dialog.no-animation { opacity: 1; transform: none; }

        .dialog-content {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(250, 250, 250, 0.98) 100%);
            backdrop-filter: blur(10px);
            border-radius: clamp(10px, 2.5vw, 15px);
            padding: clamp(16px, 4vw, 24px);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-height: calc(85vh - 6px);
            box-sizing: border-box;
        }

        .dialog-title-spacer { 
            height: clamp(8px, 2vh, 16px); 
            flex-shrink: 0; 
        }

        .dialog-title {
            font-size: clamp(17px, 3.5vw, 20px);
            color: rgba(20, 20, 20, 0.95);
            margin-bottom: clamp(12px, 3vw, 16px);
            text-align: center;
            letter-spacing: -0.01em;
            flex-shrink: 0;
        }

        .dialog-message-align[align="center"] { align-items: center; text-align: center; }
        .dialog-message-align[align="left"] { align-items: flex-start; text-align: left; }
        .dialog-message-align[align="right"] { align-items: flex-end; text-align: right; }

        .dialog-message-container {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            margin-bottom: clamp(14px, 3vw, 20px);
            min-height: clamp(40px, 10vh, 60px);
            max-height: clamp(200px, 50vh, 400px);
            padding: clamp(8px, 2vw, 12px) clamp(6px, 1.5vw, 10px);
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        /* 優化滾動條 */
        .dialog-message-container::-webkit-scrollbar { 
            width: clamp(7px, 1.8vw, 9px); 
        }
        .dialog-message-container::-webkit-scrollbar-track { 
            background: rgba(0, 0, 0, 0.06); 
            border-radius: 5px;
            margin: 4px 0;
        }
        .dialog-message-container::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.5) 100%);
            border-radius: 5px;
            border: 2px solid rgba(0, 0, 0, 0.06);
            background-clip: padding-box;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
        }
        .dialog-message-container::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.7) 100%);
            background-clip: padding-box;
        }

        .dialog-message {
            font-size: clamp(14px, 3.2vw, var(--message-font-size));
            color: rgba(30, 30, 30, 0.92);
            line-height: 1.7;
            word-wrap: break-word;
            word-break: break-word;
            overflow-wrap: break-word;
            letter-spacing: 0.01em;
        }

        .dialog-input-container { 
            flex-shrink: 0; 
            margin-bottom: clamp(14px, 3vw, 20px);
        }

        /* 輸入框 */
        .dialog-input {
            width: 100%;
            padding: clamp(11px, 2.5vw, 13px) clamp(14px, 3.5vw, 18px);
            border: 2px solid rgba(40, 40, 40, 0.9);
            border-radius: clamp(8px, 2vw, 10px);
            font-size: clamp(14px, 3vw, 16px);
            font-weight: 450;
            background: linear-gradient(135deg, rgba(25, 25, 25, 0.98) 0%, rgba(15, 15, 15, 0.99) 100%);
            color: rgba(255, 255, 255, 0.95);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            letter-spacing: 0.02em;
            box-sizing: border-box;
            box-shadow: 
                0 2px 6px rgba(0, 0, 0, 0.15),
                inset 0 1px 3px rgba(0, 0, 0, 0.4),
                inset 0 0 0 1px rgba(255, 255, 255, 0.05);
        }

        .dialog-input::placeholder { 
            color: rgba(180, 180, 180, 0.5);
            font-weight: 400;
            text-align: center; 
        }

        .dialog-input:focus {
            outline: none;
            border-color: rgba(60, 60, 60, 1);
            background: linear-gradient(135deg, rgba(30, 30, 30, 1) 0%, rgba(20, 20, 20, 1) 100%);
            color: rgba(255, 255, 255, 1);
            box-shadow: 
                0 4px 12px rgba(0, 0, 0, 0.25),
                0 0 0 3px rgba(80, 80, 80, 0.2),
                inset 0 1px 3px rgba(0, 0, 0, 0.3),
                inset 0 0 0 1px rgba(255, 255, 255, 0.08);
            transform: translateY(-1px);
        }

        .dialog-input:hover:not(:focus) {
            border-color: rgba(50, 50, 50, 0.95);
            box-shadow: 
                0 3px 8px rgba(0, 0, 0, 0.18),
                inset 0 1px 3px rgba(0, 0, 0, 0.35),
                inset 0 0 0 1px rgba(255, 255, 255, 0.07);
        }

        .dialog-buttons {
            display: flex;
            gap: clamp(8px, 2vw, 12px);
            justify-content: flex-end;
            flex-shrink: 0;
            flex-wrap: wrap;
        }

        .dialog-button {
            padding: clamp(10px, 2.2vw, 12px) clamp(20px, 4.5vw, 28px);
            border: none;
            border-radius: clamp(7px, 1.5vw, 9px);
            font-size: clamp(13px, 2.8vw, 15px);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            min-width: clamp(70px, 16vw, 90px);
            letter-spacing: 0.02em;
            position: relative;
            overflow: hidden;
            outline: none;
            box-sizing: border-box;
        }

        .dialog-button::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: translate(-50%, -50%);
            transition: width 0.5s, height 0.5s;
            pointer-events: none;
        }

        .dialog-button:active::before { 
            width: 320px; 
            height: 320px; 
        }

        /* 主要按鈕 */
        .dialog-button-primary {
            background: linear-gradient(135deg, rgba(30, 30, 30, 0.96) 0%, rgba(10, 10, 10, 0.98) 100%);
            color: rgba(255, 255, 255, 0.98);
            border: 1.5px solid rgba(0, 0, 0, 0.2);
            box-shadow: 
                0 2px 8px rgba(0, 0, 0, 0.2),
                0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .dialog-button-primary:hover {
            background: linear-gradient(135deg, rgba(40, 40, 40, 0.98) 0%, rgba(20, 20, 20, 0.98) 100%);
            transform: translateY(-1px);
            border-color: rgba(0, 0, 0, 0.25);
            box-shadow: 
                0 4px 12px rgba(0, 0, 0, 0.25),
                0 2px 4px rgba(0, 0, 0, 0.15);
        }

        .dialog-button-primary:active {
            transform: translateY(0);
            box-shadow: 
                0 1px 4px rgba(0, 0, 0, 0.2),
                0 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* 次要按鈕 */
        .dialog-button-secondary {
            background: rgba(255, 255, 255, 0.9);
            color: rgba(20, 20, 20, 0.9);
            border: 1.5px solid rgba(0, 0, 0, 0.15);
            box-shadow: 
                0 1px 3px rgba(0, 0, 0, 0.08),
                inset 0 1px 0 rgba(255, 255, 255, 0.5);
        }

        .dialog-button-secondary:hover {
            background: rgba(255, 255, 255, 0.95);
            color: rgba(10, 10, 10, 0.95);
            border-color: rgba(0, 0, 0, 0.25);
            transform: translateY(-1px);
            box-shadow: 
                0 2px 6px rgba(0, 0, 0, 0.12),
                inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }

        .dialog-button-secondary:active {
            transform: translateY(0);
            box-shadow: 
                0 1px 2px rgba(0, 0, 0, 0.08),
                inset 0 1px 2px rgba(0, 0, 0, 0.06);
            background: rgba(245, 245, 245, 0.95);
        }

        /* 位置類 */
        .position-top { place-items: start center; }
        .position-center { place-items: center; }
        .position-bottom { place-items: end center; }
        .position-left { place-items: center start; }
        .position-right { place-items: center end; }

        /* 小屏幕優化 */
        @media (max-width: 640px) {
            .dialog-overlay { padding: 16px; }
            .dialog { width: 100%; min-width: unset; max-width: calc(100vw - 32px); }
            .dialog-buttons { flex-direction: column-reverse; gap: 10px; }
            .dialog-button { width: 100%; min-width: unset; padding: 12px 20px; }
            .dialog-message-container { max-height: 60vh; }
        }

        @media (max-width: 380px) {
            .dialog-overlay { padding: 8px; }
            .dialog { border-radius: 12px; max-width: calc(100vw - 16px); }
            .dialog-content { padding: 14px; }
            .dialog-title { font-size: 16px; margin-bottom: 12px; }
            .dialog-message { font-size: 13px; line-height: 1.65; }
            .dialog-input { padding: 10px 12px; }
        }

        /* 動畫定義 */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes dialogFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dialogFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideFromTop { from { transform: translateY(clamp(-40px, -10vw, -60px)); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideToTop { from { transform: translateY(0); opacity: 1; } to { transform: translateY(clamp(-40px, -10vw, -60px)); opacity: 0; } }
        @keyframes slideFromBottom { from { transform: translateY(clamp(40px, 10vw, 60px)); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideToBottom { from { transform: translateY(0); opacity: 1; } to { transform: translateY(clamp(40px, 10vw, 60px)); opacity: 0; } }
        @keyframes slideFromLeft { from { transform: translateX(clamp(-40px, -10vw, -60px)); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .slideToLeft { from { transform: translateX(0); opacity: 1; } to { transform: translateX(clamp(-40px, -10vw, -60px)); opacity: 0; } }
        @keyframes slideFromRight { from { transform: translateX(clamp(40px, 10vw, 60px)); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideToRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(clamp(40px, 10vw, 60px)); opacity: 0; } }
        @keyframes scaleIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes scaleOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.7); opacity: 0; } }
    `;

    class DialogManager {
        constructor() {
            add.style(dialogStyle, "dialog-style", false);

            // 對話框隊列管理
            this.dialogQueue = [];
            this.currentDialog = null;
            this.isProcessing = false;
            this.transitionDelay = 100; // 多對話框間的過渡延遲

            // 位置映射表
            this.positionMap = {
                top: 'position-top',
                center: 'position-center',
                bottom: 'position-bottom',
                left: 'position-left',
                right: 'position-right'
            };

            // 動畫類型映射表
            this.animationMap = {
                fade: 'animated-fade',
                top: 'animated-slide-top',
                bottom: 'animated-slide-bottom',
                left: 'animated-slide-left',
                right: 'animated-slide-right',
                scale: 'animated-scale'
            };

            // 動畫持續時間映射表（毫秒）
            this.durationMap = {
                fade: 400,
                top: 450,
                bottom: 450,
                left: 450,
                right: 450,
                scale: 450
            };
        };

        stopScene() {
            if (!SceneManager?._stopped) SceneManager.stop();
        };

        resumeScene() {
            if (SceneManager?._stopped) SceneManager.resume();
        };

        // 獲取位置對應的 CSS 類名
        getPositionClass(position) {
            return this.positionMap[position] || 'position-center';
        };

        // 獲取動畫對應的 CSS 類名
        getAnimationClass(animation) {
            if (!animation || animation === 'none') return 'no-animation';
            if (animation === true) return 'animated-fade';
            return this.animationMap[animation] || 'animated-fade';
        };

        // 獲取動畫持續時間
        getAnimationDuration(animation) {
            if (!animation || animation === 'none') return 0;
            if (animation === true) return 400;
            return this.durationMap[animation] || 400;
        };

        // 將隊列中的對話框入隊
        enqueue(options) {
            return new Promise(resolve => {
                this.dialogQueue.push({ options, resolve });
                if (!this.isProcessing) this.processQueue();
            })
        };

        // 處理對話框隊列
        async processQueue() {
            if (this.dialogQueue.length === 0) {
                this.isProcessing = false;
                this.resumeScene();
                return;
            }

            this.isProcessing = true;
            const { options, resolve } = this.dialogQueue.shift();
            const hasNextDialog = this.dialogQueue.length > 0;

            // 首次顯示對話框時暫停場景
            if (!this.currentDialog) this.stopScene();

            // 關閉當前對話框
            if (this.currentDialog) {
                await this.closeCurrentDialog(this.currentDialog.animation, hasNextDialog);
                if (hasNextDialog) {
                    await new Promise(r => setTimeout(r, this.transitionDelay));
                }
            }

            // 創建新對話框
            const result = await this.createDialog(options);
            resolve(result);

            this.processQueue();
        };

        // 關閉當前對話框
        closeCurrentDialog(animation, hasNextDialog = false) {
            return new Promise(resolve => {
                if (!this.currentDialog) return resolve();

                const { overlay, dialog } = this.currentDialog;
                const duration = this.getAnimationDuration(animation);

                const cleanup = () => {
                    overlay.remove();
                    this.currentDialog = null;
                    resolve();
                };

                if (duration > 0 && !hasNextDialog) {
                    overlay.style.transition = 'none';
                    void overlay.offsetHeight; // 強制重繪

                    overlay.classList.add('closing');
                    dialog.classList.add('closing');
                    setTimeout(cleanup, duration);
                } else if (hasNextDialog) {
                    overlay.style.transition = 'opacity 0.15s ease-out';
                    overlay.style.opacity = '0';
                    setTimeout(cleanup, 150);
                } else {
                    cleanup();
                }
            })
        };

        // 創建對話框
        createDialog(rawOptions) {
            return new Promise(resolve => {
                const {
                    type = 'alert',
                    message = '',
                    title = '',
                    confirmText = 'OK',
                    cancelText = 'Cancel',
                    defaultValue = '',
                    placeholder = 'Enter text...',
                    position = 'center',
                    width = 420,
                    fontSize = 18,
                    autoClose = false,
                    duration = 3,
                    animation = 'fade',
                    align = 'center',
                } = rawOptions;

                const overlayAnimationClass = !animation || animation === 'none'
                    ? 'no-animation' : 'animated-fade';
                const dialogAnimationClass = this.getAnimationClass(animation);
                const positionClass = this.getPositionClass(position);
                const hasQueue = this.dialogQueue.length > 0;

                const showCancelBtn = type === 'confirm' || type === 'prompt';
                const showInput = type === 'prompt';

                const html = `
                    <div class="dialog-overlay ${overlayAnimationClass} ${positionClass}"
                         ${hasQueue ? 'style="opacity: 0;"' : ''}>
                        <div class="dialog ${dialogAnimationClass}" 
                             style="--dialog-width: ${width}px;">
                            <div class="dialog-content">
                                ${title ? `<div class="dialog-title">${title}</div>` : '<div class="dialog-title-spacer"></div>'}
                                <div class="dialog-message-align dialog-message-container" align="${align}">
                                    <div class="dialog-message-align dialog-message" 
                                         align="${align}" 
                                         style="--message-font-size: ${fontSize}px;">
                                        ${message.replace(/\n/g, '<br>')}
                                    </div>
                                </div>
                                ${showInput ? `
                                    <div class="dialog-input-container">
                                        <input class="dialog-input" 
                                               type="text" 
                                               value="${defaultValue}" 
                                               placeholder="${placeholder}"
                                               style="text-align: center;">
                                    </div>
                                ` : ''}
                                <div class="dialog-buttons">
                                    ${showCancelBtn ? `
                                        <button class="dialog-button dialog-button-secondary" data-action="cancel">
                                            ${cancelText}
                                        </button>
                                    ` : ''}
                                    <button class="dialog-button dialog-button-primary" data-action="confirm">
                                        ${confirmText}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                // 解析模板為 DOM 元素
                document.body.appendChild(
                    document.createRange().createContextualFragment(html)
                );

                const overlay = document.querySelector('.dialog-overlay');

                const dialog = overlay.querySelector('.dialog');
                const inputElement = overlay.querySelector('.dialog-input');
                const confirmBtn = overlay.querySelector('[data-action="confirm"]');
                const cancelBtn = overlay.querySelector('[data-action="cancel"]');

                // 確認/取消/背景點擊
                const handleClose = (confirmed) => {
                    let result;
                    if (type === 'prompt') {
                        result = confirmed ? (inputElement?.value ?? '') : null;
                    } else {
                        result = confirmed;
                    }

                    const hasNextInQueue = this.dialogQueue.length > 0;
                    const duration = this.getAnimationDuration(animation);

                    const cleanup = () => {
                        overlay.remove();
                        if (this.currentDialog?.overlay === overlay) {
                            this.currentDialog = null;
                        }
                        if (!hasNextInQueue) this.resumeScene();
                        resolve(result);
                    };

                    if (duration > 0 && !hasNextInQueue) {
                        overlay.style.transition = 'none';
                        void overlay.offsetHeight; // 強制重繪

                        overlay.classList.add('closing');
                        dialog.classList.add('closing');
                        setTimeout(cleanup, duration);
                    } else if (hasNextInQueue) {
                        overlay.style.transition = 'opacity 0.15s ease-out';
                        overlay.style.opacity = '0';
                        setTimeout(cleanup, 150);
                    } else {
                        cleanup();
                    }
                };

                overlay.addEventListener('pointerup', e => {
                    const target = e.target;

                    // 點擊確認按鈕
                    if (target === confirmBtn || target.closest('[data-action="confirm"]')) {
                        handleClose(true);
                    }
                    // 點擊取消按鈕
                    else if (target === cancelBtn || target.closest('[data-action="cancel"]')) {
                        handleClose(false);
                    }
                    // 點擊模態背景（overlay 本身，不是 dialog 內部）
                    // else if (target === overlay) {
                    // handleClose(false);
                    // }
                });

                // 輸入框 Enter 鍵處理
                if (inputElement) {
                    inputElement.addEventListener('keydown', e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleClose(true);
                        }
                    })
                };

                this.currentDialog = { overlay, dialog, animation };

                // 隊列淡入處理
                if (hasQueue) {
                    requestAnimationFrame(() => {
                        overlay.style.transition = 'opacity 0.2s ease-in';
                        overlay.style.opacity = '1';
                    })
                }

                // 延遲聚焦
                setTimeout(() => {
                    if (inputElement) {
                        inputElement.focus();
                    } else {
                        confirmBtn?.focus();
                    }
                }, hasQueue ? 150 : 50);

                // 自動關閉
                if (autoClose && duration > 0) {
                    setTimeout(() => {
                        if (this.currentDialog?.overlay === overlay) {
                            handleClose(true);
                        }
                    }, duration * 1000);
                }
            });
        };
    };

    const dialogManager = new DialogManager();

    Object.assign(window, {
        alert: (message, options = {}) => dialogManager.enqueue({
            type: 'alert',
            message: String(message ?? ''),
            ...options
        }),
        confirm: (message, options = {}) => dialogManager.enqueue({
            type: 'confirm',
            message: String(message ?? ''),
            ...options
        }),
        prompt: (message, defaultValue = '', options = {}) => dialogManager.enqueue({
            type: 'prompt',
            message: String(message ?? ''),
            defaultValue: String(defaultValue ?? ''),
            ...options
        })
    });

})();
