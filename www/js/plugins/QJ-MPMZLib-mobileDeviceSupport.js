//=============================================================================
 /*:
 * @plugindesc 移动设备适配用脚本
 * @author shiroin
 */
//=============================================================================
var QJ = QJ || {};
QJ.VB = QJ.VB || {};

var chahuiUtil = chahuiUtil || {};
// 根据用户端跳转Discord
chahuiUtil.jumpToDiscordServer = function () {
	
	let url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSc9bl2zSdkbhz_EeRndV7lSRBVSBtMRUk_rY0O1FQWWw4W0XVm9_ja__2ClO2BMfCJrN-YnlMAd-OL/pubhtml';
	
		if ( Utils.isMobileDevice() ) {
            window.open(url, '_system');
           } else {
            require('nw.gui').Shell.openExternal(url);
        }
				
};

// 兼容旧存档的脚本调用残留
Game_System.prototype.drill_GFPT_remove = function( slot_id, style_id ){
	return true;
};

Game_Interpreter.prototype.fadeSpeed = function() {
    return 16;
};

// 根据条件切换虚拟按键
QJ.MPMZ.tl._setDirButtonMode = function() { 
   
   if (QJ && QJ.VB && QJ.VB.readyVirtualButton) {
     const dirBtn = QJ.VB.findDirButton();
     if (dirBtn) {
       const targetMode = $gameMessage.isChoice() ? 0 : 2;
       if (dirBtn._dirMode !== targetMode) {
         ConfigManager.VBData.dirMode = targetMode;
         // 强制自身重建一次
         dirBtn.changeDirMode(targetMode);
       }
     }
   }
};


// 根据条件切换虚拟按键
QJ.VB.showFastForwardButton = function() { 
   var messageWindow = SceneManager._scene && SceneManager._scene._messageWindow && SceneManager._scene._messageWindow.isOpen() && !$gameMessage.isChoice();
   return messageWindow;
};


/*
为游戏标题增加版本标记
*/
(function() {

  if (!Utils.isMobileDevice()) return;
	
  const FONT_FACE   = "MPLUS2ExtraBold";
  const FONT_SIZE   = 28;
  const PADDING_X   = 20;                // 距左侧
  const PADDING_Y   = 20;                // 距底部
  const COLOR       = "#d3d2d2";
  const OUTLINE_COL = "rgba(0,0,0,0.9)";
  const OUTLINE_W   = 3;

  const SHOW_FALLBACK  = true;          // 没匹配到是否仍显示默认文本
  const FALLBACK_TEXT  = "Wrong Version";             // 没匹配到时显示的文字（SHOW_FALLBACK=true时生效）

  function extractVersionFromTitle(title) {
    if (!title) return null;

    // 优先匹配 "ver..."
    let m = title.match(/(ver\s*\d[\w.\-]*)/i);
    if (m && m[1]) {
      // 规范化空格：去掉 ver 与数字之间的空格 → "ver0.75"
      return m[1].replace(/\s+/g, "").replace(/^VER/i, "✦Ver");
    }

    return null;
  }

  function drawVersionOnTitle(scene) {
    const bmp = scene._gameTitleSprite && scene._gameTitleSprite.bitmap;
    if (!bmp) return;

    const title = ($dataSystem && $dataSystem.gameTitle) || "";
    let text = extractVersionFromTitle(title);
    if (!text) {
      if (!SHOW_FALLBACK || !FALLBACK_TEXT) return;
      text = FALLBACK_TEXT;
    }

    const x = PADDING_X;
    const lineH = FONT_SIZE + 8;
    const y = Graphics.height - (PADDING_Y + lineH);

    // 备份
    const pf  = bmp.fontFace;
    const pz  = bmp.fontSize;
    const pc  = bmp.textColor;
    const poc = bmp.outlineColor;
    const pow = bmp.outlineWidth;

    // 设置字体与颜色
    bmp.fontFace     = FONT_FACE;
    bmp.fontSize     = FONT_SIZE;
    bmp.textColor    = COLOR;

    // 关闭描边
    bmp.outlineWidth = 0;
    bmp.outlineColor = "rgba(0,0,0,0)";

    // 关闭阴影（直接操作 Canvas2D 上下文）
    if (bmp._context) {
      const ctx = bmp._context;
      ctx.shadowColor   = "rgba(0,0,0,0)";
      ctx.shadowBlur    = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    bmp.drawText(text, x, y, Graphics.width - x * 2, lineH, "left");
    bmp._setDirty && bmp._setDirty();

    // 还原
    bmp.fontFace     = pf;
    bmp.fontSize     = pz;
    bmp.textColor    = pc;
    bmp.outlineColor = poc;
    bmp.outlineWidth = pow;
  }

  const _Title_createForeground = Scene_Title.prototype.createForeground;
  Scene_Title.prototype.createForeground = function() {
    _Title_createForeground.call(this);
    drawVersionOnTitle(this);
  };
})();



/*:
  绘制物品、技能生效范围提醒
 */
(function(){

  if (!window.QJ) window.QJ = {};
  if (!QJ.MPMZ) QJ.MPMZ = {};
  if (!QJ.MPMZ.tl) QJ.MPMZ.tl = {};

  var _hb = {}; // index -> PIXI.Graphics

  // 独立图层（避免塞进 _pictureContainer 触发 PictureCallCommon）
  function hitboxLayer(){
    var sc = SceneManager._scene, ss = sc && sc._spriteset;
    if (!ss) return null;
    if (!ss._qjSingleHBLayer){
      ss._qjSingleHBLayer = new Sprite(); 
      ss.addChild(ss._qjSingleHBLayer);
    }
    return ss._qjSingleHBLayer;
  }

  // Graphics 封装
  function BulletHitboxGfx(index, opt){
    PIXI.Graphics.call(this);
    this._index = index;
    opt = opt || {};
    this._fill       = (typeof opt.color === 'number') ? opt.color : 0xff6a00;
    this._alpha      = (opt.alpha != null) ? opt.alpha : 0.35;
    this._line       = (typeof opt.lineColor === 'number') ? opt.lineColor : 0xd15700;
    this._stroke     = (opt.stroke === false) ? false : true;  // 是否描边
    this._lineWidth  = (opt.lineWidth != null) ? opt.lineWidth : 1;
    this._lineAlpha  = (opt.lineAlpha != null) ? opt.lineAlpha : 0.5;
  }
  BulletHitboxGfx.prototype = Object.create(PIXI.Graphics.prototype);
  BulletHitboxGfx.prototype.constructor = BulletHitboxGfx;

  BulletHitboxGfx.prototype.update = function(){
    this.clear();
    if (!$gameMap.bulletQJ) return;
    var bullet = $gameMap.bulletQJ(this._index);
    if (!bullet || !bullet.QJBody) return;

    var body = bullet.QJBody;
    var ox = $gameMap.displayX() * $gameMap.tileWidth();
    var oy = $gameMap.displayY() * $gameMap.tileHeight();
    var sx = function(x){ return x - ox; };
    var sy = function(y){ return y - oy; };

    this.beginFill(this._fill, this._alpha);
    if (this._stroke && this._lineWidth > 0 && this._lineAlpha > 0){
      this.lineStyle(this._lineWidth, this._line, this._lineAlpha);
    } else {
      this.lineStyle(0); // 关闭描边
    }

    if (body.calcPoints && body.pos){
      var pts = body.calcPoints;
      if (pts && pts.length){
        this.moveTo(sx(pts[0].x + body.pos.x), sy(pts[0].y + body.pos.y));
        for (var i=1;i<pts.length;i++){
          this.lineTo(sx(pts[i].x + body.pos.x), sy(pts[i].y + body.pos.y));
        }
        this.closePath();
      }
    } else if (body.r != null && body.pos){

      this.drawCircle(sx(body.pos.x), sy(body.pos.y), body.r);
    } else if (body.w != null && body.h != null && body.pos){
      this.drawRect(sx(body.pos.x - body.w/2), sy(body.pos.y - body.h/2), body.w, body.h);
    }

    this.endFill();
  };

  // 对外 API：显示 / 更新参数
  QJ.MPMZ.tl.showBulletHitbox = function(index, opt){
    var layer = hitboxLayer(); if (!layer) return;
    var g = _hb[index];
    if (!g){
      g = new BulletHitboxGfx(index, opt || {});
      _hb[index] = g;
      layer.addChild(g);
    } else if (opt){
      if (opt.color     != null) g._fill      = opt.color;
      if (opt.alpha     != null) g._alpha     = opt.alpha;
      if (opt.lineColor != null) g._line      = opt.lineColor;
      if (opt.stroke    != null) g._stroke    = !!opt.stroke;
      if (opt.lineWidth != null) g._lineWidth = opt.lineWidth;
      if (opt.lineAlpha != null) g._lineAlpha = opt.lineAlpha;
    }
    g.update();
    return g;
  };

  //  主动删除：可在子弹的 deadJS 里调用
  QJ.MPMZ.tl.removeBulletHitbox = function(index){
    var g = _hb[index];                 // ← 修正：使用 _hb
    if (!g) return;
    if (g.parent) g.parent.removeChild(g);
    delete _hb[index];
  };

  // 清理全部（比如换图前手动调用）
  QJ.MPMZ.tl.removeAllBulletHitboxes = function(){
    for (var k in _hb){                 // ← 修正：使用 _hb
      var g = _hb[k];
      if (g && g.parent) g.parent.removeChild(g);
      delete _hb[k];
    }
  };
})();




/*:
  低画质模式
 */
(function(){
  "use strict";
  if (typeof Utils !== 'undefined' && Utils.isMobileSafari && Utils.isMobileSafari()) {
    return;
  }

  const LOWSCALE = 0.5;          // scaleResolution === true 时采用的缩放倍率
  const INCLUDE_PICTURES = true; // 是否把图片层(常见弹幕/特效)也纳入低分辨率
  const DEBUG_WATERMARK  = false;


  function readEnabledBool(){
    try { return !!(ConfigManager && ConfigManager.scaleResolution); }
    catch(_) { return false; }
  }
  function currentScale(enabled){ return enabled ? LOWSCALE : 1.0; }

  // ===== Spriteset_Map：建立低分辨率 RT 与显示精灵 =====
  const _createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
  Spriteset_Map.prototype.createLowerLayer = function(){
    _createLowerLayer.call(this);
    this._qj_lowResRT = null;
    this._qj_lowResSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this._qj_lowResSprite.anchor.set(0, 0);
    this._qj_lowResSprite.position.set(0, 0);
    this.addChildAt(this._qj_lowResSprite, 0);

    if (DEBUG_WATERMARK) {
      const box = new PIXI.Container();
      const g = new PIXI.Graphics();
      g.beginFill(0x000000, 0.5).drawRect(0, 0, 92, 22).endFill();
      const txt = new PIXI.Text('LOWRES', {fill:'#00FF88', fontSize: 14});
      txt.x = 6; txt.y = 3; box.addChild(g); box.addChild(txt);
      box.zIndex = 999999; this.addChild(box);
    }

    // 缓存当前启用状态；首次置 null 以强制创建
    this._qj_curEnabled = null;
  };

  // 重建/旁路 RT（仅当开关变化或强制重建时调用）
  function rebuildRTIfNeeded(sset, enabled){
    if (sset._qj_curEnabled === enabled && sset._qj_lowResRT) return;
    if (sset._qj_lowResRT) { sset._qj_lowResRT.destroy(true); sset._qj_lowResRT = null; }
    sset._qj_curEnabled = enabled;
    const scale = currentScale(enabled);

    if (scale >= 0.999) { // 旁路：不使用 RT
      sset._qj_lowResSprite.texture = PIXI.Texture.EMPTY;
      return;
    }
    const lowW = Math.max(1, Math.floor(Graphics.width  * scale));
    const lowH = Math.max(1, Math.floor(Graphics.height * scale));
    sset._qj_lowResRT = PIXI.RenderTexture.create(lowW, lowH);
    sset._qj_lowResSprite.texture = sset._qj_lowResRT;
  }

  // 尺寸变化时强制重建
  const _onResize = Graphics._onResize;
  Graphics._onResize = function(){
    _onResize.call(this);
    const sc = SceneManager._scene;
    if (sc && sc._spriteset){
      const s = sc._spriteset;
      if (s._qj_lowResRT) { s._qj_lowResRT.destroy(true); s._qj_lowResRT = null; }
      s._qj_curEnabled = null; // 标记下一帧重建
    }
  };

  // ===== 拦截底层 WebGL 渲染（屏幕 pass → 离屏 pass）=====
  if (PIXI && PIXI.WebGLRenderer) {
    const _origRender = PIXI.WebGLRenderer.prototype.render;
    let _guard = false;

    // 离屏缩小矩阵
    const _mat = new PIXI.Matrix();
    function matScale(scale){
      _mat.a = scale; _mat.b = 0;
      _mat.c = 0;     _mat.d = scale;
      _mat.tx = 0;    _mat.ty = 0;
      return _mat;
    }

    // 抵消父级（Spriteset_Map）缩放，避免与 DP_MapZoom 叠乘
    function applyCancelParentScale(sset, scale){
      const parentScale = (sset.scale && sset.scale.x) ? sset.scale.x : 1;
      const k = 1 / (scale * parentScale); // 让最终视觉缩放不受父级影响
      sset._qj_lowResSprite.scale.set(k, k);
    }

    // 读取开关并在变化时标记重建（极低开销）
    let _lastEnabled = null;
    function readAndMark(){
      const v = readEnabledBool();
      if (v !== _lastEnabled){ _lastEnabled = v; window.__QJ_LR_needRebuild = true; }
      return v;
    }

    PIXI.WebGLRenderer.prototype.render = function(displayObject, renderTexture, clear, transform, skipUpdateTransform){
      const scene = SceneManager && SceneManager._scene;
      const mainPass = !renderTexture && scene && (scene instanceof Scene_Map);
      const sset = mainPass ? scene._spriteset : null;
      const ok = sset && sset._qj_lowResSprite && sset._baseSprite;

      if (!_guard && ok) {
        const enabled = readAndMark();
        if (window.__QJ_LR_needRebuild){ rebuildRTIfNeeded(sset, enabled); window.__QJ_LR_needRebuild = false; }

        const scale = currentScale(enabled);

        // 旁路：关闭时直接按原逻辑渲染（低分辨率 sprite 不参与）
        if (scale >= 0.999 || !sset._qj_lowResRT) {
          const prev = sset._qj_lowResSprite.renderable;
          sset._qj_lowResSprite.renderable = false;
          const ret = _origRender.call(this, displayObject, renderTexture, clear, transform, skipUpdateTransform);
          sset._qj_lowResSprite.renderable = prev;
          return ret;
        }

        const base = sset._baseSprite; // 地图/人物/天气等
        const pics = (INCLUDE_PICTURES && sset._pictureContainer) ? sset._pictureContainer : null;
        const low  = sset._qj_lowResSprite;

        // 屏幕 pass：不画 base/pics，只显示低分辨率贴图 + UI；并抵消父级缩放
        applyCancelParentScale(sset, scale);
        const prevBaseR = base.renderable;
        const prevPicsR = pics ? pics.renderable : null;
        const prevLowR  = low.renderable;

        base.renderable = false;
        if (pics) pics.renderable = false;
        low.renderable  = true;

        _guard = true;
        const ret = _origRender.call(this, displayObject, renderTexture, clear, transform, skipUpdateTransform);
        _guard = false;

        // 离屏 pass：把 base(+pics) 缩小后写到 RT（跳过 transform 更新 → 避开 Drill 钩子）
        try {
          const m = matScale(scale);
          base.renderable = true;
          _origRender.call(this, base, sset._qj_lowResRT, true,  m, true);
          if (pics) { pics.renderable = true; _origRender.call(this, pics, sset._qj_lowResRT, false, m, true); }
        } catch(e){ /* 忽略偶发 */ }

        // 恢复
        base.renderable = prevBaseR;
        if (pics) pics.renderable = prevPicsR;
        low.renderable  = prevLowR;

        return ret;
      }

      return _origRender.call(this, displayObject, renderTexture, clear, transform, skipUpdateTransform);
    };
  } else {
    console.warn('[QJ_LowResMap_UseConfigScale] WebGLRenderer not found; plugin disabled.');
  }

  // 清理
  const _terminate = Spriteset_Map.prototype.terminate || function(){};
  Spriteset_Map.prototype.terminate = function(){
    try{
      if (this._qj_lowResRT)     { this._qj_lowResRT.destroy(true); this._qj_lowResRT = null; }
      if (this._qj_lowResSprite) { this._qj_lowResSprite.destroy({children:true, texture:false, baseTexture:false}); this._qj_lowResSprite = null; }
    } finally { if (_terminate) _terminate.call(this); }
  };

})();


// 低画质模式警告
QJ.MPMZ.tl.lowResModeWarning = function() {
   if (typeof Utils !== 'undefined' && Utils.isMobileSafari && Utils.isMobileSafari()) {
     ConfigManager.scaleResolution = false;
     ConfigManager.save();
     return;
   }
   if (!ConfigManager.scaleResolution ) {
	 if ( ConfigManager.scaleResolution == undefined )  ConfigManager.scaleResolution = false;
	   
     let textArray = window.systemFeatureText && window.systemFeatureText.lowResModeWarning;
     if (!textArray) {
	   textArray = [
    	   "This feature is mainly for performance optimization on Android devices and may have little effect on the PC version.",
		   "When enabled, the game renders maps and images at a lower resolution and then scales them up, ",
		   "reducing GPU load on mobile devices and lowering heat generation and power consumption.",
		   "Note: This is an experimental feature, and its effectiveness may vary depending on the device.",
		   "You can disable this feature at any time to immediately restore full image clarity."
       ];
     }
	 let text = Array.isArray(textArray) ? textArray.join("\n") : (textArray ?? "");
     alert(text);
   }

   ConfigManager.scaleResolution = !ConfigManager.scaleResolution;
   ConfigManager.save();	
};


/*:
 为了解决0.81开始出现的卡顿问题，原因诊断为平均每2秒都会自动触发一次缓存回收
 */
(function(){
  'use strict';
  function apply(){
    var r = Graphics && Graphics._renderer, gc = r && r.textureGC;
    if (!gc) return false;
    var fps = 60;                   // 目标帧率
    gc.checkCount = fps * 300;      // 5 分钟扫描一次
    gc.maxIdle    = 1800;           // 半小时未用才清理
    if (gc.checkCountMax != null) gc.checkCountMax = gc.checkCount;
    return true;
  }
  // 渲染器创建后立刻套用
  var _create = Graphics._createRenderer;
  Graphics._createRenderer = function(){ _create.apply(this, arguments); apply(); };
  // 兜底：若有别的插件重建了 renderer，则轮询直到成功一次
  (function poll(i){ if (!apply() && i<600) setTimeout(poll,16, i+1); })(0);
})();



/*:
 * 图像、音频加载失败时不报错（带兜底资源）
 */
(() => {
	

  // 兜底资源（无需带扩展名）
  const DEFAULT_IMAGE = 'projectiles/null1';
  const DEFAULT_AUDIO = 'se/013myuu_YumeSE_SystemBuzzer02';

  // 小工具
  const isImg   = (u) => u && u.startsWith('img');
  const isAudio = (u) => u && u.startsWith('audio');

  //==============================
  // Bitmap: _requestImage
  //==============================
  const _Bitmap_requestImage = Bitmap.prototype._requestImage;
  Bitmap.prototype._requestImage = function(url) {
    // 复用池
    this._image = Bitmap._reuseImages.length ? Bitmap._reuseImages.pop() : new Image();

    if (this._decodeAfterRequest && !this._loader) {
      this._loader = ResourceHandler.createLoader(
        url,
        this._requestImage.bind(this, url),
        this._onError.bind(this),
        null,
        this
      );
    }

    this._url = url;
    this._loadingState = 'requesting';

    if (!Decrypter.checkImgIgnore(url) && Decrypter.hasEncryptedImages) {
      this._loadingState = 'decrypting';
      Decrypter.decryptImg(url, this);
    } else {
      this._image.src = url;
      this._image.addEventListener('load',  this._loadListener  = Bitmap.prototype._onLoad.bind(this));
      this._image.addEventListener('error', this._errorListener = this._loader || Bitmap.prototype._onError.bind(this));
    }
  };

  //==============================
  // WebAudio: initialize
  //==============================
  const _WebAudio_initialize = WebAudio.prototype.initialize;
  WebAudio.prototype.initialize = function(url) {
    if (!WebAudio._initialized) WebAudio.initialize();
    this.clear();

    if (!WebAudio._standAlone) {
      this._loader = ResourceHandler.createLoader(
        url,
        this._load.bind(this, url),
        () => { this._hasError = true; },
        null,
        this
      );
    }
    this._load(url);
    this._url = url;
  };

  //==============================
  // ResourceHandler: createLoader
  //==============================
  const _RH_createLoader = ResourceHandler.createLoader;
  ResourceHandler.createLoader = function(url, retryMethod, resignMethod, retryInterval, self) {
    const intervals   = retryInterval || this._defaultRetryInterval;
    const reloaders   = this._reloaders;
    let   retryCount  = 0;
    let   triedDefault = false;

    return function loader() {
      // 1) 正常重试
      if (retryCount < intervals.length) {
        setTimeout(typeof retryMethod === 'function' ? retryMethod : () => {}, intervals[retryCount++]);
        return;
      }

      // 2) 兜底：图片 / 音频（只尝试一次）
      if (self && !triedDefault && ((isImg(url) && DEFAULT_IMAGE) || (isAudio(url) && DEFAULT_AUDIO))) {
        triedDefault = true;
        retryCount   = 0;

      if (isImg(url) && DEFAULT_IMAGE) {
        // 逻辑扩展名：始终 .png
        const fallback = `img/${DEFAULT_IMAGE}.png`;
		url = decodeURIComponent(url);
		let text = `Fail to load ${url}. \nIf possible, please report it in our Discord. \nYou can continue playing after closing this popup.`;
		if (ConfigManager.language == 0) {
			text = `无法读取文件: ${url}. \n请将此错误报告在我们的Discord里 \n关闭该弹窗后可继续游戏！`;
		}
        alert(text);
        retryMethod = self._requestImage ? self._requestImage.bind(self, fallback) : retryMethod;
        setTimeout(typeof retryMethod === 'function' ? retryMethod : () => {}, intervals[retryCount++]);
        return;
      }

      if (isAudio(url) && DEFAULT_AUDIO) {
        const _audioExt = (typeof AudioManager !== 'undefined' && AudioManager.audioFileExt) ? AudioManager.audioFileExt() : '.ogg';
        const fallback = `audio/${DEFAULT_AUDIO}${_audioExt}`;
		url = decodeURIComponent(url);
		let text = `Fail to load ${url}. \nIf possible, please report it in our Discord. \nYou can continue playing after closing this popup.`
		if (ConfigManager.language == 0) {
			text = `无法读取文件: ${url}. \n请将此错误报告在我们的Discord里 \n关闭该弹窗后可继续游戏！`;
		}		
        alert(text);
        retryMethod = self._load ? self._load.bind(self, fallback) : retryMethod;
        setTimeout(typeof retryMethod === 'function' ? retryMethod : () => {}, intervals[retryCount++]);
        return;
      }
      }

      // 3) 放弃：沿用引擎默认“可重载”逻辑（会打印错误并停止）
      if (resignMethod) resignMethod();
      if (url) {
        if (reloaders.length === 0) {
          Graphics.printLoadingError(url);
          SceneManager.stop();
        }
        reloaders.push(function() {
          retryCount = 0;
          if (typeof retryMethod === 'function') retryMethod();
        });
      }
    };
  };
})();


/* 解决游戏窗口失焦时残留按键判定的问题 */
(() => {
  const orig = Input._setupEventHandlers;
  Input._setupEventHandlers = function(){
    orig.call(this);
    const clearAll = () => { Input.clear(); if (window.TouchInput) TouchInput.clear(); };
    window.addEventListener('blur', clearAll);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') clearAll();
    });
    window.addEventListener('pagehide', clearAll); // 移动端 & bfcache
  };
})();

/* filter 应用失败时直接跳过 */
/* 案例：消息窗口在渲染时应用了模糊滤镜，然后 shader 编译失败/对象无效 */
(function() {
  // 只在移动端有效
  if (!Utils.isMobileDevice()) return;

  if (!window.PIXI || !PIXI.Filter || !PIXI.Filter.prototype) return;
  if (PIXI.Filter.prototype.__mobileSafeApply) return;
  PIXI.Filter.prototype.__mobileSafeApply = true;

  const _apply = PIXI.Filter.prototype.apply;
  PIXI.Filter.prototype.apply = function(filterManager, input, output, clear, currentState) {
    try {
      return _apply.call(this, filterManager, input, output, clear, currentState);
    } catch (e) {
      console.warn("[Mobile] Filter.apply skipped:", e);
      // 跳过滤镜，避免整局崩溃
      return;
    }
  };
})();
