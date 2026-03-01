//=============================================================================
//
//=============================================================================
/*:
 * @target MV MZ
 * @plugindesc [弹幕模板库][妹妹互动监听]
 * @author 仇九
 *
 * @help 
 * 
 *
 */
//=============================================================================
//妹妹场景相关
//=============================================================================

// 妹妹贿赂系统
QJ.MPMZ.tl.ImoutoBribeSystem = function (extra={}) {
	
	if (extra.isBribeSuccessful) {
		
		return;
    }
	
	if (extra.createList) {
        $gameTemp._canBribeImouto = false;
	    //  初始化可用来贿赂妹妹的道具列表	
		let list  = $gameParty.customItemTypeList('canBribeImouto');
        //  金钱道具，通常用于给妹妹零花钱
        if (!extra.disableOkane) {
            let gold  = $gameParty._gold || 0;
            let okane = [6,7,8,9,10];
            
            for (let i = 0; i < okane.length; i++) {
                let index = okane[i];
                let price = $dataItems[index]?.price;
                if (price && gold >= price ) {
                    list.push(index);
                }
            }
        }

        if (list.length) $gameTemp._canBribeImouto = true;
		return list;	
	}
};
 
// 妹妹膝枕/掏耳朵
QJ.MPMZ.tl.ImoutoLapPillowAndEarCleaning = function (extra={}) {
   if (extra.listenTime) {
	   const currentDay       = $gameSystem.day();
	   const hour             = $gameSystem.hour();
	   const minute           = $gameSystem.minute();
	   const currentMinutes   = currentDay * 1440 + hour * 60 + minute;
       let forceEnd = false;
	   
       if ($gameTemp._ImoutoLapPillowEndedEarly >= 8 ) {
		   forceEnd = true;
	   }
	   
	   if (!this._forceEndTime && $gameTemp._ImoutoForcedRest) {
		   // 妹妹犯困，设置超时时间		   
		   this._forceEndTime = currentMinutes + 20;
	   }	   
	   if (this._forceEndTime && this._forceEndTime >= currentMinutes) {
		   forceEnd = true;
	   }
	   
	   if (forceEnd) {
		   // 强制结束当前事件
		   chahuiUtil.abortEventById(-1);
		   $gameMap.event(3).steupCEQJ(3, {forceEnd:true});
		   this.setDead({t:['Time',0]});
	   }	   
       return;
   }
   
   $gameTemp._shouldSkipSleepEvent = true;
   QJ.MPMZ.Shoot({
		groupName: ['ImoutoLapPillow'],
		existData: [ 
		],
		moveF: [
		    [60,30,QJ.MPMZ.tl.ImoutoLapPillowAndEarCleaning, [{listenTime:true}]]
		]
    });   
};

// 妹妹摸头反应弹幕
QJ.MPMZ.tl._imoutoUtilHeadPatReaction = function (extra={}) {
  const IDX = extra.index;
  if (!IDX || !this) return;
  const eidStr = String(this._eventId);
  const mapId = $gameMap.mapId();

  // 取表：window["MapEventDialogue<mapId>"]
  const key = `MapEventDialogue${mapId}`;
  const table = window?.[key];
  if (!table) return;

  // 取数组：table[eidStr][IDX]
  const row = table?.[eidStr];
  const textArray = Array.isArray(row?.[IDX]) ? row[IDX] : null;
  if (!textArray || textArray.length === 0) return;

  // 随机抽取文本（确保是字符串）
  const randIdx = (Math.random() * textArray.length) | 0;
  const raw = textArray[randIdx];
  const textBody = (raw == null) ? "" : String(raw);
  if (!textBody) return;

  const text = `\\dDCOG[11:2:2:2]\\fs[32]${textBody}`;
  $gameTemp.drill_GFTT_createSimple([1480,215], text, 5, 9, 150);  
  
  if (extra.patVoice) {
	 let randomIndex = randIdx + 7;
     let voice = "sis_room_tachie_touch_" + randomIndex.padZero(2);
     AudioManager.playVoice({ name: voice, volume: 90, pitch: 100, pan: 0 }, false, 1);  
  }
};

// 妹妹小人差分切换
QJ.MPMZ.tl._imoutoUtilResetImoutoChibiState = function (extra={}) {
	
	QJ.MPMZ.deleteProjectile('ImoutoBlinking');
	$gameSelfSwitches.setValue([$gameMap.mapId(), this._eventId, 'S'], false);
	let IMG = "sis_room/sis_room_dozingOff1";

	if ($gameVariables.value(20) < 40) {
	// 妹妹在生气	
	   IMG = "sis_room/sis_room_angryImouto";
	}	
	if ($gameActors.actor(2).isStateAffected(35)) {
	// 粉色糖果影响
	   IMG = "sis_room/[NSFW]sis_room_inHeat1";
	}
	
	let opacity = 0;
	if (extra.headpatEnd)  opacity = 255;	
    $gameScreen.showPicture(5, IMG, 0, 260, 310, 100, 100, opacity, 0);
	
	if (IMG.includes("dozingOff")) {
		// 眨眼动画
		for (let i = 2; i <= 4; i++) {
			ImageManager.loadPicture("sis_room/sis_room_dozingOff" + i);
		}
		QJ.MPMZ.Shoot({
		   groupName: ['ImoutoBlinking'],
		   existData: [ 
		   ],
		   moveF:[
			 [60,0,QJ.MPMZ.tl._imoutoUtilImoutoBlinking],
			 [90,30,QJ.MPMZ.tl._imoutoUtilImoutoBlinking,["check"]]
		   ]
		});		
	}
};
 
// 生成选项文本
QJ.MPMZ.tl._imoutoUtilGenerateOptionText = function (idx, specified, extra={}) {
  let eid     = String(specified ?? this?._eventId ?? "");
  let mapId   = $gameMap?.mapId?.() ?? 0;
  let key     = `MapEventDialogue${mapId}`;
  
  if (extra.specifiedKey) {
	  key     = extra.specifiedKey;
      if (extra.specifiedIndex) {
          key = key.specifiedKey?.specifiedIndex;
      }
  }
  
  // 检测是否为复制事件
  let event   = $gameMap.event(eid);
  if (event && event._sourceeventId) {
      eid     = Number(event._sourceeventId);
  }


  const tbl = window[key]; // 可能是 { [eid]: { [idx]: [lines...] } } 或其它
  let textArray;

  // 只在形状正确时取到数组
  if (tbl && typeof tbl === "object" && !Array.isArray(tbl)) {
    const entry = tbl[eid];
    const val   = entry && entry[String(idx)];
    if (Array.isArray(val))         textArray = val;
    else if (typeof val === "string") textArray = [val];
  } else if (Array.isArray(tbl)) {
    // 兼容老形状：window[key] 本身就是一组默认行
    textArray = tbl;
  }

  // 兜底
  if (!Array.isArray(textArray)) {
    textArray = ["textDisplayFailed","textDisplayFailed","textDisplayFailed","textDisplayFailed","textDisplayFailed"];
  }

  for (let i = 0; i < textArray.length; i++) {
    $gameStrings.setValue(6 + i, String(textArray[i] ?? ""));
  }
  return textArray;
};

// 检查是否拥有指定食材
QJ.MPMZ.tl.checkHasIngredient = function(tag) {
    var hasTag = (typeof tag === 'string') && tag.trim().length > 0;
    var needle = hasTag ? tag.trim().toLowerCase() : '';

    var items = $gameParty.items();
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item) continue;

        var count = $gameParty.numItems(item);
        if (!count) continue;  // 库存必须 > 0

        if (item.note && item.note.includes("<Ingredients:")) {
            var m = item.note.match(/<Ingredients:\s*([^>]+)>/i);
            if (!m) continue;

            var lowerIng = String(m[1]).toLowerCase();

            if (!hasTag) {
                // 没指定标签：只要是食材就返回 true
                return true;
            } else {
                // 指定标签：子串匹配
                if (lowerIng.includes(needle)) return true;
            }
        }
    }
    return false;
};

// 客厅场景事件触发判断
QJ.MPMZ.tl._imoutoUtilLivingRoomEventTriggerCheck = function(extra = {}) {

   if (extra.decideWhichShow) {
   // 决定具体看什么电视节目 
       let type   = {};
	   let IMG    = 'living_tv_light';
	   let index;
	   let mosaic = false;
	   let noise  = false;
	   switch ($gameSystem.hour()) {
              case 18: // 兔兔新闻
			     let indexArray = [1,2,7,8];
			     index = indexArray[Math.floor(Math.random() * indexArray.length)];
			     type = {BunnyNews: index};
                 IMG  = `living_tv_show${index}`;
                 break;	
              case 19: // 天气预报
			     type = {WeatherForecast: true};
                 IMG  = 'living_tv_show6';
                 break;					 
              case 20: // 美食节目（每7天强制切换为动画）
			     index = 5;
			     type = {CookingShow: index};
                 IMG  = `living_tv_show${index}`;
                 break;
              case 21: // ？？？
                 noise = true;
                 break;	
              case 22: // 自定义录像带
                 noise = true;
				 type = {LateNight: true};
                 break;
              default:  // 错误兜底
			     noise = true;
			     break;
	   } 
	   $gameScreen.showPictureFromPath(39, "living_room", IMG, 0, 112, 83, 50, 50, 255, 0);
	   if (noise)  {
		 let filterTarget = 5039;
		 $gameMap.createFilter("noise5039", "noise", filterTarget);
		 $gameMap.setFilter(id, [3]);	   
       }	   
	   
	   $gameMap.event(10).steupCEQJ(1, type);
	   return;
   }

   if (!this) return;
   if ( $gameSystem.day() === 1 ) return;
   // 后续还没写
   if ($gameSelfVariables.value([54, 5, 'animeEpisode']) > 5) return;
   
   let currentDay = $gameSystem.day();
   let lastDate = $gameSelfVariables.value([1, 2, 'lastDate']);  
   // 已经看过不再触发
   if (lastDate >= currentDay) return;
   
   let airDate = $gameSelfVariables.value([1, 2, 'animeAirDate']);
   // if (Utils.isOptionValid("test")) airDate = 1;
   // 没看过动画，随机第一集的开播时间
   if (airDate == 0) {
	   airDate = 1 + Math.randomInt(7);
	   $gameSelfVariables.setValue([1, 2, 'animeAirDate'], airDate);
   }
   // 明确具体是周几
   let week = airDate % 7;
   
   if ($gameSystem.day() >= airDate) {
	   if ($gameSystem.day() % 7 === week) {
		  // 检查是否晚点
		  let currentHour = $gameSystem.hour();
		  let currentMinute = $gameSystem.minute();
		  let totalMinute = (60 * currentHour) + currentMinute;
		  // 晚上八点开播,并限制十点后不能触发
		  if (totalMinute >= 1200 && totalMinute < 1320) {
			  let value = false;
			  totalMinute -= 1200;
			  if (totalMinute >= 30) value = totalMinute;
               // 确认有事件可触发时中止当前流程并切入事件
		        chahuiUtil.abortEventById(-1);			   
		  	    let id = 18;
    	        $gameMap.event(id).steupCEQJ(5,{later:value});
		  	    $gameSelfVariables.setValue([1, 2, 'lastDate'], currentDay);
		        this._index = this._list ? this._list.length : 0;		   
		  }
	   }
    }
};



	
// 妹妹做饭演出（旧版）
QJ.MPMZ.tl._imoutoUtilImoutoCookingAnimation = function() {
   /*
    let count = Math.randomInt(3) + 1;
	let result = $gameNumberArray.value(15);
    count = Math.min(count, result.length);   
    let selected = [];   
    for (let i = 0; i < count; i++) {
        let idx = Math.randomInt(result.length);
        selected.push(result[idx]);
        result.splice(idx, 1);
    }
	$gameNumberArray.setValue(15,selected);
   */
  let tarX = 552 + Math.randomInt(618); // xx ∈ [552, 1169]
  let tarY;
  if (tarX >= 772 && tarX <= 972) {
    tarY = 570 + Math.randomInt(750 - 570 + 1); // yy ∈ [570, 750]
  } else {
    tarY = 570 + Math.randomInt(304); // yy ∈ [570, 873]
  }

  let itemId = QJ.MPMZ.tl._imoutoUtilImoutoCookingPickIngredients({ pick: true });
  let item = $dataItems[itemId];
  if (!item) item = $dataItems[3];
  let icon = item.iconIndex;
  let posX = 865;
  let posY = 845;  
  let peakRate = 1 + (1 * Math.random());
  let { time, xExp, yExp } = QJ.MPMZ.tl.BulletTrajectoryFormula(tarX, tarY, posX, posY, peakRate,2);
  let scale = 1.5;
  if (Utils.isMobileDevice()) scale = 3;
   QJ.MPMZ.Shoot({
        img:['I',icon], 
		position:[['S',tarX],['S',tarY]],
        initialRotation:['S',0],
		opacity:'0|0~8/1~180/1',
		scale:scale,
		z:"A",
        imgRotation:['S',0],
		moveType:["F", xExp, yExp],
        existData:[ 
		    {t: ['Time', time], d:[1,10,1.2]}  
		],
		
    });
};


// 场景BGM自动降调
QJ.MPMZ.tl._imoutoSceneBgmAutoPitchLowering = function () {
	
	if ( !this || !(this instanceof Game_QJBulletMZ) ) return;
	
    let count = 100 - this.time;
	count = Math.max(0, count);
    if (AudioManager._currentBgm) {
      let b = AudioManager._bgmBuffer;
      if (b && b._sourceNode) {
          b._pitch = (AudioManager._currentBgm.pitch = count) / 100;
          b._sourceNode.playbackRate.setValueAtTime(
              b._pitch, WebAudio._context.currentTime
          );
          b._startTime = WebAudio._context.currentTime - b.seek() / b._pitch;
          b._removeEndTimer(); b._createEndTimer();
        }
    } 
};

// 降采样 + 只改速率 + 下限保护
QJ.MPMZ.tl._imoutoSceneBgsAutoPitchLowering = function () {
	
  if (!(this instanceof Game_QJBulletMZ)) return;
  
  const MIN_PITCH = 0.01;     // 不要到 0
  const MAX_PITCH = 2.0;
  const EPS       = 0.01;    // 变化阈值

    // 计算目标 pitch，并做上下限裁剪
    let target = (100 - this.time) / 100;
    target = Math.max(MIN_PITCH, Math.min(MAX_PITCH, target));

    for (const key in AudioManager._currentAllBgs) {
      const curBgs = AudioManager._currentAllBgs[key];
      const buf    = AudioManager._allBgsBuffer[key];
      const node   = buf && buf._sourceNode;
      if (!curBgs || !node) continue;

      const cur = node.playbackRate.value;
      if (Math.abs(cur - target) < EPS) continue;

      // 只更新播放速率，不动 _startTime / 定时器
      node.playbackRate.setValueAtTime(target, WebAudio._context.currentTime);
      curBgs.pitch = target; // 若有其它插件读取这里，保持同步
    }

};



// 场景BGM自动适配
QJ.MPMZ.tl._imoutoSceneBgmSelection = function () {
	
	let randomBgmArray = ["The-Freedom-Hunter","Le thé de l'après-midi"];
	
	if ($gameSystem.hour() > 5 && $gameSystem.hour() < 17) {
	 let weather = $gameVariables.value(60);
     switch (weather) {
       case 0:
	     randomBgmArray = ["The-Freedom-Hunter","Le thé de l'après-midi","セレスタの森"];
       break;
       case 1:
	     randomBgmArray = ["野うさぎのワルツ", "植物愛好家の団欒","窓硝子に伝う雨"];
       break;	   
       case 2:
	     randomBgmArray = ["この雨が上がったら", "Matin-Pluvieux","雨上がりにステップを"];
       break;	   
	 }
    } else {
		// 夜晚场景
		 randomBgmArray = ["Apprentie Jardinière","できたてブレッツェルはいかが？","Cafe-et-Croissant","ほんのりいい感じなピアノ","ふんわりシフォンとカプチーノ","Strahlburg", 
		                  "Café de Strahlburg - Charlotte", "Important-Thing", "木漏れ日の調べ", "シュトラールブルクの休日", "見習い魔女と古都の晩景"]; 
	}
	
	let randomBgm = randomBgmArray[Math.floor(Math.random() * randomBgmArray.length)];	
	AudioManager.playBgm({ name: randomBgm, volume: 90, pitch: 100, pan: 0 });    	
	   
};


// 妹妹状态描述刷新
QJ.MPMZ.tl._imoutoUtilStateDescriptionRefresh = function() {
	
        let actor = $gameActors.actor(2);
	    let imoutoText = QJ.MPMZ.tl._imoutoUtilStateText;
        let mapId = $gameMap.mapId();
        // 立绘标记移除
        if (actor.isStateAffected(27)) {
            for (let i = 28; i <= 32; i++) {
                actor.removeState(i);
            }
            return;
        }

        // 妹妹玩游戏
        if (actor.isStateAffected(28)) {
			let sid    = 28;
			let States = window.statesDescription[String(sid)] ? window.statesDescription[String(sid)] : {};
			let subtitle = States.subtitle.join();
            // 移除立绘标记
            for (let i = 29; i <= 32; i++) {
                actor.removeState(i);
            }
			$gameStrings.setValue(41, subtitle);
			let textArray = "";
			let index = Math.randomInt(2);
            textArray = States.variants[String(index)]["description"];
			if (!textArray[0].includes("✦\\fi\\c[110]")) {
			textArray[0] = "✦\\fi\\c[110]" + textArray[0];
			}			
            $dataStates[28].description = textArray.join("\n");
            return;
        }
        // 妹妹洗澡中
        if (actor.isStateAffected(29)) {
			let sid    = 29;
			let States = window.statesDescription[String(sid)] ? window.statesDescription[String(sid)] : {};
			let subtitle = States.subtitle.join();
			$gameStrings.setValue(41, subtitle);
			let textArray = "";
			let index = 0;
			if ($gameMap.mapId() == 4) index = 1;
            textArray = States.variants[String(index)]["description"];
			if (!textArray[0].includes("✦\\fi\\c[110]")) {
			textArray[0] = "✦\\fi\\c[110]" + textArray[0];
			}			
            $dataStates[29].description = textArray.join("\n");
            return;
        }
        // 妹妹休息中
        if (actor.isStateAffected(30)) {
			let sid    = 30;
			let States = window.statesDescription[String(sid)] ? window.statesDescription[String(sid)] : {};
			let subtitle = States.subtitle.join();
			$gameStrings.setValue(41, subtitle);
			// 根据心情值切换描述
            var mood = $gameVariables.value(20);
			var textArray = "";
            if ($gameScreen.picture(5) && $gameScreen.picture(5).name().includes("rubEyes")) {
                textArray = States.variants["5"]["description"];
				if (!textArray[0].includes("✦\\fi\\c[110]")) {
				textArray[0] = "✦\\fi\\c[110]" + textArray[0];
				}
				$dataStates[30].description = textArray.join("\n");
				return;
            }
            if (mood >= 70) {
				let index = Math.randomInt(2);
                textArray = States.variants[String(index)]["description"];
            } else if (mood >= 45) {
                textArray = States.variants["2"]["description"];
            } else {
				let index = 3 + Math.randomInt(2);
                textArray = States.variants[String(index)]["description"];
            } 
			if (!textArray[0].includes("✦\\fi\\c[110]")) {
			textArray[0] = "✦\\fi\\c[110]" + textArray[0];
			}
			$dataStates[30].description = textArray.join("\n");
            return;
        }		
        // 妹妹睡眠中(根据睡眠欲变化文本)
        if (actor.isStateAffected(31)) {
			let sid    = 31;
			let States = window.statesDescription[String(sid)] ? window.statesDescription[String(sid)] : {};
			if (!States.variants) {
               $dataStates[31].description = "\\c[10]Missing translation";
               return;				
			}			
			let subtitle = States.subtitle.join();
			$gameStrings.setValue(41, subtitle);
			// 根据睡眠值切换描述
            var sleepDesire = $gameVariables.value(19);
			let textArray;
      	    if (sleepDesire >= 70) {
     	       textArray = States.variants["5"]?.["description"];
    	    } else if (sleepDesire >= 50) {
     	       textArray = States.variants["4"]?.["description"];
     	    } else if (sleepDesire >= 30) {
      	       textArray = States.variants["3"]?.["description"];
    	    } else if (sleepDesire >= 10) {
     	       textArray = States.variants["2"]?.["description"];
    	    } else if (sleepDesire >= 0) {
      	       textArray = States.variants["1"]?.["description"];
    	    } else {
     	       textArray = States.variants["0"]?.["description"];
      	    }
			// 和哥哥一起睡
			if (mapId === 21) {
			   textArray = States.variants["6"]?.["description"];
			}
			
			if (!textArray) textArray = [""];
			if (!textArray[0].includes("✦\\fi\\c[110]")) {
			textArray[0] = "✦\\fi\\c[110]" + textArray[0];
			}
			$dataStates[31].description = textArray.join("\n");
            return;
        }
        // 妹妹肚子饿
        if (actor.isStateAffected(32)) {
			let sid    = 32;
			let States = window.statesDescription[String(sid)] ? window.statesDescription[String(sid)] : {};
			if (!States.variants) {
               $dataStates[32].description = "\\c[10]Missing translation";
               return;				
			}			
			let subtitle = States.subtitle.join();
			$gameStrings.setValue(41, subtitle);
			let textArray;
			let index = Math.randomInt(3);
            textArray = States.variants[String(index)]["description"];
			if (!textArray[0].includes("✦\\fi\\c[110]")) {
			textArray[0] = "✦\\fi\\c[110]" + textArray[0];
			}			
            $dataStates[32].description = textArray.join("\n");
            return;
        }
        // 妹妹乘凉中
        if (actor.isStateAffected(33)) {
			let sid    = 33;
			let States = window.statesDescription[String(sid)] ? window.statesDescription[String(sid)] : {};
			if (!States.variants) {
               $dataStates[33].description = "\\c[10]Missing translation";
               return;				
			}			
			let subtitle = States.subtitle.join();
			$gameStrings.setValue(41, subtitle);
            let textArray = States.variants["0"]["description"];
			if (!textArray[0].includes("✦\\fi\\c[110]")) {
			textArray[0] = "✦\\fi\\c[110]" + textArray[0];
			}			
            $dataStates[33].description = textArray.join("\n");
            return;
        }		
        // 妹妹刷牙中
        if (actor.isStateAffected(34)) {
			let sid    = 34;
			let States = window.statesDescription[String(sid)] ? window.statesDescription[String(sid)] : {};
			if (!States.variants) {
               $dataStates[34].description = "\\c[10]Missing translation";
               return;				
			}			
			let subtitle = States.subtitle.join();
			$gameStrings.setValue(41, subtitle);
            let textArray = States.variants["0"]["description"];
			if (!textArray[0].includes("✦\\fi\\c[110]")) {
			textArray[0] = "✦\\fi\\c[110]" + textArray[0];
			}			
            $dataStates[34].description = textArray.join("\n");
            return;
        }
        // 妹妹辣哭了
        if (actor.isStateAffected(40)) {
			let sid    = 40;
			let States = window.statesDescription[String(sid)] ? window.statesDescription[String(sid)] : {};
			if (!States.variants) {
               $dataStates[40].description = "\\c[10]Missing translation";
               return;				
			}
			let subtitle = States.subtitle.join();
			$gameStrings.setValue(41, subtitle);
            let textArray = States.variants["0"]["description"];
			if (!textArray[0].includes("✦\\fi\\c[110]")) {
			textArray[0] = "✦\\fi\\c[110]" + textArray[0];
			}			
            $dataStates[40].description = textArray.join("\n");
            return;
        }
        // 妹妹看电视
        if (actor.isStateAffected(42)) {
			let sid    = 42;
			let States = window.statesDescription[String(sid)] ? window.statesDescription[String(sid)] : {};
			if (!States.variants) {
               $dataStates[42].description = "\\c[10]Missing translation";
               return;				
			}
			let subtitle = States.subtitle.join();
			$gameStrings.setValue(41, subtitle);
            let textArray = States.variants["0"]["description"];
			if (!$gameScreen.picture(7)) {  // 坐在一起
				if (States.variants["1"] && States.variants["1"]["description"]) {
					textArray = States.variants["1"]["description"];
				}
			}
			if (!textArray[0].includes("✦\\fi\\c[110]")) {
			    textArray[0] = "✦\\fi\\c[110]" + textArray[0];
			}			
            $dataStates[42].description = textArray.join("\n");
            return;
        }
        // 妹妹被吓到
        if (actor.isStateAffected(43)) {
			let sid    = 43;
			let States = window.statesDescription[String(sid)] ? window.statesDescription[String(sid)] : {};
			if (!States.variants) {
               $dataStates[sid].description = "\\c[10]Missing translation";
               return;				
			}
			let subtitle = States.subtitle.join();
			$gameStrings.setValue(41, subtitle);
            let textArray = States.variants["0"]["description"];
			if ($gameMap.getGroupBulletListQJ('segs').length > 0) {
			   // 在色色
			   textArray = States.variants["1"]["description"];
			}
			if (!textArray[0].includes("✦\\fi\\c[110]")) {
			textArray[0] = "✦\\fi\\c[110]" + textArray[0];
			}			
            $dataStates[sid].description = textArray.join("\n");
            return;
        }		
};

// 不同状态妹妹点击效果
QJ.MPMZ.tl._imoutoDifferentStateClickEffects = function () {
    let imouto = $gameActors.actor(2);

    // 坐着的妹妹
    if (imouto.isStateAffected(30)) {
        if ($gameMap.mapId() === 4) {
			
			if ($gameScreen.picture(5) && $gameScreen.picture(5).name().includes("dozingOff")) {				
				// 妹妹犯困
			  if ($gameSelfSwitches.value([$gameMap.mapId(), 15, 'S'])) {
				  $gameMap.event(15).steupCEQJ(6);
				  return;
			  }
			}			
			$gameMap.event(15).start();
        return;
	  }
    }

    // 玩游戏的妹妹
    if (imouto.isStateAffected(28)) {
        if ($gameMap.mapId() === 4) {
            $gameScreen._pictureCidArray = [];
            $gameMap.event(2).steupCEQJ(3);
        }
        if ($gameMap.mapId() === 7) {
            $gameMap.event(26).start();
        }
        return;
    }

    // 洗澡中的妹妹
    if (imouto.isStateAffected(29)) {
        if ($gameMap.mapId() === 3) {
            if ($gameMessage.isBusy() || SceneManager._scene._messageWindow._choiceWindow.active) return;
			if ($gameMap.isAnyEventStartingQJ()) return;
            $gameMap.event(17).start();
        }
        if ($gameMap.mapId() === 4) {
            $gameMap.event(13).start();
        }
        return;
    }

    // 睡着的妹妹
    if (imouto.isStateAffected(31)) {
        if ($gameScreen.picture(1) && $gameScreen.picture(1)._name === "sister_room_night2_fine") {
            $gameMap.event(7).steupCEQJ(2); // 触发夜袭流程
			return;
        }
        if ($gameMap.mapId() === 54) {
            $gameMap.event(3).start(); // 早晨看望妹妹
			return;
        }
        if ($gameMap.mapId() === 4) {
            $gameMap.event(35).start(); // 早晨看望妹妹
			return;
        }		
		
        return;
    }

    // 饿肚子的妹妹
    if (imouto.isStateAffected(32)) {
        if ($gameMap.mapId() === 11) {
            $gameMap.event(21).start();
        }
        return;
    }

    // 炎热天气乘凉的妹妹
    if (imouto.isStateAffected(33) && ($gameMap.mapId() === 4 || $gameMap.mapId() === 54)) {
        if ($gameParty.hasItem($dataItems[19])) {
			let eid = 50;
			if ($gameMap.mapId() === 54)  eid = 9;
            $gameMap.event(eid).steupCEQJ(1); // 有电风扇
        } else {
            // 被热晕的妹妹，区分有无T恤
            let picture = $gameScreen.picture(6);
			let eid = 49;
			if ($gameMap.mapId() === 54)  eid = 8;			
            if (picture && picture.name() === "sis_room/sis_room_chibi_sleep_hot") {
                $gameMap.event(eid).steupCEQJ(2);
            } else {
                $gameMap.event(eid).steupCEQJ(3);
            }
        }
        return;
    }

    // 被辣哭了的妹妹
    if (imouto.isStateAffected(40)) {
        $gameScreen._pictureCidArray = [];
		if ($gameMap.mapId() === 4) {
          $gameMap.event(45).steupCEQJ(2);
		} else {
		  $gameMap.event(6).steupCEQJ(2);		
		}
        return;
    }
};


//显示妹妹描述窗口
QJ.MPMZ.tl._imoutoUtilDisplayStatusHud = function () {

        const imouto       = $gameActors.actor(2);
		const mapId        = $gameMap.mapId();
		const isWatchingTV = imouto.isStateAffected(42) || imouto.isStateAffected(43);
		const isBrush      = imouto.isStateAffected(34);
		const isHot        = imouto.isStateAffected(33);
		const ishungry     = imouto.isStateAffected(32);
		const isSleep      = imouto.isStateAffected(31);
		const isIdle       = imouto.isStateAffected(30);
        const isBath       = imouto.isStateAffected(29);
		const isGaming     = imouto.isStateAffected(28);
		
		const isTachie  = imouto.isStateAffected(27) || ($gameScreen.picture(16) && $gameScreen.picture(16)._y == 150 && $gameScreen.picture(16)._opacity > 250);
		
        let state1 = " ";
        let state2 = " ";
        let panties = "\\sa[159]";
		let gap = 96;
        let description = [];
        let sisName = $gameStrings.value(120) || "Mio";
		// 越南语特殊处理，不显示妹妹名
		if ([0,1,2,5,7].includes(ConfigManager.language)) sisName = '';
		description.push(`\\fs[20]\\str[41]${sisName}`);
		description.push(`\\fs[30]\\i[2]\\fs[20] ???`);
        let dropsName = window.prototypeEventTemplate["possibleDrops"].join();
        
        const affectedList = imouto.getStateCategoryAffectedList('imoutoState');
        
        // 生成第一个状态描述（若存在）
        if (affectedList[0]) {
            state1 = $dataStates[ affectedList[0] ].description;	
            gap -= 16;			
        }
        // 生成第二个状态描述（若存在）
        if (affectedList[1]) {
            state2 = $dataStates[ affectedList[1] ].description;
			gap -= 10;	
        }
		description.push(`\\py[8]\\fs[16]${state1}`);
		description.push(`\\py[35]\\fs[16]${state2}`);  
        description.push(`\\fs[16]\\py[${gap}]✦${dropsName}:`); 		
        // 妹妹的内衣描述
        if (imouto.equips()[1]) {
           panties = "\\ia[" + imouto._equips[1]._itemId + "]";
        } 
		
        description.push(`\\fs[16]\\py[${gap}]${panties}`); 	
        /*		
		if (isMobileDevice) {
        description = "\\fs[24]\\str[41]" + sisName +
                      "\n\\fs[30]\\i[2]\\fr ???" +
                      "\n\\py[8]\\fs[18]" + state1 +
                      "\n\\py[28]\\fs[18]" + state2 +
                      "\n\\py[28]✦\\fs[18]" + dropsName + ":" +
                      "\n\\py[-4]" + panties;
		}
        */
        let pid = 5;
		if (isSleep)      pid = mapId !== 21 ? 3 : 5;
		if (isBath)       pid = mapId === 4 ? 4 : 8;
        if (isBrush)      pid = 9;				
		if (isHot )       pid = 6;
		if (isWatchingTV) pid = imouto.isStateAffected(43) ? 80 : 5;
        let picture = $gameScreen.picture(pid);
		if (!picture) return;
        let bind    = DrillUp.g_MPFP_list[8];
		// 初始化偏移值
		DrillUp.g_MPFP_style_list[4]['x'] = 100;
		DrillUp.g_MPFP_style_list[4]['y'] = 10;	
		
        if ((picture._opacity > 200 || isWatchingTV) && !picture._drill_MPFP_bean) {
			picture.drill_COPWM_setPixelHoverEnabled(true);
            picture._drill_MPFP_bean = new Drill_MPFP_Bean();
            $gameTemp._drill_MPFP_needRestatistics = true;
            picture.drill_COPWM_checkData();
            picture._drill_MPFP_bean.drill_bean_setVisible(true);
            picture._drill_MPFP_bean.drill_bean_setContextList(description);
            picture._drill_MPFP_bean.drill_bean_setSkinStyle(bind['style_mode'], bind['style_lockedId']);			
        }
		
		if (!isWatchingTV && picture._opacity < 200 && picture._drill_MPFP_bean) {
			picture._drill_MPFP_bean.drill_bean_setVisible( false );
			picture._drill_MPFP_bean.drill_bean_setSkinStyle( "默认皮肤样式", -1 );
		}

	
	if (!$gameParty.leader().hasSkill(7)) return;
	
    const koukan = [30, 32, 33, 34, 40, 42, 43];
    const keikai = [28, 31];
    let frameX, frameY;

    // 定义hud坐标
    function setFrameAndHudPositions(index, frameX, frameY) {
        $gameSystem._drill_GFV_bindTank[5].visible = true;
        $gameSystem._drill_GFV_bindTank[6].visible = true;
        $gameSystem._drill_GFV_bindTank[index].visible = true;

        $gameSystem._drill_GFV_bindTank[5].frame_x = frameX;
        $gameSystem._drill_GFV_bindTank[5].frame_y = frameY;
        $gameSystem._drill_GFV_bindTank[6].frame_x = frameX + 8;
        $gameSystem._drill_GFV_bindTank[6].frame_y = frameY + 20;
        $gameSystem._drill_GFV_bindTank[index].frame_x = frameX - 105;
        $gameSystem._drill_GFV_bindTank[index].frame_y = frameY + 30;

        $gameTemp._drill_GFV_needRefresh = true;
    }
   
	if (isTachie) {
		frameX = 1410; frameY = 110;	
        setFrameAndHudPositions(7, frameX, frameY);	
        return;		
	}
	
	
    // Handle 好感度UI类型
    if (koukan.some(stateId => imouto.isStateAffected(stateId))) {
        if (isIdle) { // 普通坐
            frameX = 463; frameY = 370; 
        } else if (ishungry) { // 餐厅普通坐
		    DrillUp.g_MPFP_style_list[4]['x'] = 100;
			DrillUp.g_MPFP_style_list[4]['y'] = 10;
            frameX = 820; frameY = 530; 
        } else if (imouto.isStateAffected(33)) { // 吹风扇乘凉
            if ($gameParty.hasItem($dataItems[19])) {
                if ($gameScreen.picture(6)?.name() === "sis_room/sis_room_chibi6_back0") { // 站姿妹妹
                    frameX = 850; frameY = 300; 
                } else {
                    frameX = 750; frameY = 600; 
                }
            } else {
                if ($gameScreen.picture(6)?.name() === "sis_room/sis_room_chibi6_back0") { // 中暑妹妹
                    frameX = 1340; frameY = 450; 
                } else {
                    frameX = 850; frameY = 300; 
                }
            }
        } else if (imouto.isStateAffected(34)) { // 刷牙
            frameX = 1100; frameY = 150; 
        } else if (imouto.isStateAffected(40)) { // 被辣哭
		    frameX = 1350; frameY = 450; 
		} else if (isWatchingTV) {
			if (imouto.isStateAffected(43)) { // 看电视/被吓到
                frameX = 1080; frameY = 120; 
			} else {
				if (!$gameScreen.picture(7)) {  // 坐在一起
                   frameX = 1280; frameY = 380; 
				} else {
				   frameX = 1560; frameY = 380; 
				}
			}
			DrillUp.g_MPFP_style_list[4]['x'] = -350;
	    } 
        setFrameAndHudPositions(7, frameX, frameY);	
        return;		
    }

    // Handle 警戒度UI类型
    if (keikai.some(stateId => imouto.isStateAffected(stateId))) {
        if (isGaming) { // 玩游戏
            if ($gameMap.mapId() === 4) {
                frameX = 463; frameY = 370; hudX = 400; hudY = 450;
            } else {
                frameX = 720; frameY = 120; hudX = 660; hudY = 150;
            }
        } else if (isSleep) { // 睡觉中
				DrillUp.g_MPFP_style_list[4]['x'] = -420;				
            if ([4,54].includes(mapId)) {
                frameX = 1340; frameY = 450; hudX = 1350; hudY = 460;
            } else if (!$gameSwitches.value(44)) { // 夜袭是否拉近距离
                frameX = 850; frameY = 230; hudX = 620; hudY = 300;
            } else {
                frameX = 700; frameY = 160; hudX = 450; hudY = 250;
            }
			
			if (mapId === 21) {  // 一起睡觉
				frameX = 700; frameY = 400; hudX = 840; hudY = 430;
			}
        }

        setFrameAndHudPositions(8, frameX, frameY, hudX, hudY);
		return;	
    }
	
	//特殊状态-洗澡
	if (isBath) { // 洗澡中
	    if ($gameMap.mapId() === 4) {
			frameX = 1100; frameY = 550; hudX = 1000; hudY = 600;		
            setFrameAndHudPositions(7, frameX, frameY, hudX, hudY);			
		} else {
			DrillUp.g_MPFP_style_list[4]['x'] = -350;
			frameX = 1400; frameY = 280; hudX = 1300; hudY = 360;		
            setFrameAndHudPositions(8, frameX, frameY, hudX, hudY);	
		}
		return;
	}		
	
};
//妹妹描述窗口淡入演出
QJ.MPMZ.tl._imoutoUtilMoveStatusHud = function() {

    if ( $gameSystem._drill_GFPT_dataTank[10] ) {
		let distance;
		if ($gameActors.actor(2).isStateAffected(31) && $gameMap.mapId() === 19) {
			distance = -150;
		 } else {
			distance = 150;
		 }
		  var data = $gameSystem._drill_GFPT_dataTank[ 10 ];
                var m_data = {
				    "x": data['x'] + distance,
				    "y": data['y'],
				    "time":30,
				    "type":"增减速移动",
 				   }
				$gameSystem.drill_GFPT_moveTo( 10, m_data );
		 	
				var o_data = {
                    "opacity":255,
                    "time":30,
                    "type":"匀速变化",
                   }
                $gameSystem.drill_GFPT_opacityTo( 10, o_data );				
	}
};

//常态存在的妹妹监听器
QJ.MPMZ.tl._imoutoUtilCheckInitialization = function(forbid) {
	if (typeof Utils !== 'undefined' && Utils.isMobileSafari && Utils.isMobileSafari()) {
		forbid = true;
	}
    
	//if (Utils.isOptionValid("test")) return;
	
	// 同步游戏时长
	QJ.MPMZ.tl.showGameTimeAndDays();
	// 镜头强制复位	
	dp_setZoom(1);
	let playedTime = $gameSystem.truePlaytimeText(false, true);
    document.title = $dataSystem.gameTitle + `    [PlayTime: ${playedTime}]`;
    if (window.nw?.Window) nw.Window.get().title = document.title;	
    
	// 快捷互动按钮
	let condition = $gameScreen.picture(5) && $gameScreen.picture(5).name().includes("dozingOff");
	if (!forbid && condition) chahuiUtil.quickInteractionIconInitialize();

	if ($gameMap.getGroupBulletListQJ('imoutoUtil').length > 0) return;
	// 防范事件残留误判为系统忙碌	
	$gameSwitches.setValue(14, false);
	$gameMap.cleanCommonEventQJ(4);
	// 清除玩家的死亡状态标记
    $gameParty.leader()._deadness = false;
	// 重置对话框文本速率
    $gameSystem._drill_DMS_speedMode = DrillUp.g_DMS_defaultSpeedMode;	
    // 重置快进、鉴赏模式标记
    $gameTemp._disableFastForward = undefined;
    $gameTemp._forceSkipText = undefined;

    let imoutoUtil = QJ.MPMZ.Shoot({
		groupName:['imoutoUtil'],
        position:[['P'],['P']],
        initialRotation:['S',0],
        imgRotation:['F'],
        collisionBox:['C',1],
        moveType:['D',false],
        existData:[	
        ],
		moveF:[
		  [60,180,QJ.MPMZ.tl._imoutoUtilkokanBarFades],  //监听妹妹HUD隐藏
		  [30,20,QJ.MPMZ.tl._imoutoUtilOniiChansHpBarFades],   //监听哥哥体力HUD隐藏
		  [180,180,QJ.MPMZ.tl._imoutoUtilListenEquipEffectImpact]  // 监听装备效果影响
		],
    });	
	
	if ( $gameMap.mapId() === 4 ) {
		imoutoUtil.addMoveData("F",[30,1,QJ.MPMZ.tl._imoutoUtilCallSisterOver]);   //监听呼叫妹妹过来操作	
        if (Imported.shiroin_autoUpdateSystem) imoutoUtil.addMoveData("F",[60,3600,chahuiUtil.autoUpdataCheck]);  // 自动更新检测
	}
	
	// 防范可能存在的UI未隐藏问题
	if ( !$dataMap.note.includes("<深渊>") ) {
		
		$gameSwitches.setValue(3, false);
		// 防鼠标转向
		ctb.useTurnPlayer = false;
		// 对话框样式
		$gameSystem._drill_DSk_messageStyleId = 3;
		let id = DrillUp.g_DOp_defaultStyleId;
		$gameSystem._drill_DOp_curStyle = JSON.parse(JSON.stringify( DrillUp.g_DOp_list[ id-1 ] ));
		// 地图小按钮全部隐藏
		if ($gameSystem._drill_GBu_dataTank) {
		  let tank = $gameSystem._drill_GBu_dataTank;	
  		  for (var i = 0; i < tank.length; i++) {
  		      if (tank[i]) tank[i].visible = false;
  		  }
  		}
		// 将天数显示以外的UI全部隐藏
		if ($gameSystem._drill_GFV_bindTank) {
		  let tank = $gameSystem._drill_GFV_bindTank;	
  		  for (var i = 3; i < tank.length; i++) {
  		      if (tank[i]) tank[i].visible = false;
  		  }
		  // 标记刷新
		  $gameTemp._drill_GFV_needRefresh = true;
  		}		
		// 金钱显示框
		$gameSystem._ghud_visible = false;		
	}
	
	// 重置系统语言标记
   let titleText = $dataSystem.gameTitle;
   if (titleText.includes("和存在感薄弱")) {
        $gameVariables.setValue(1, 0);
    } else if (titleText.includes("存在感薄い")) {
        $gameVariables.setValue(1, 1);
    } else {
        $gameVariables.setValue(1, 2);
    }
    // 重置鼠标指针
	CustomCursor.reset();
    // 识别到修改工具
	if (window.checkModify) {
	   QJ.MPMZ.tl.gameDataModificationWarning();
	}
};

// 识别到修改工具
QJ.MPMZ.tl.gameDataModificationWarning = function() {

  let lang  = (ConfigManager.language != null) ? ConfigManager.language : 0;
  let line0 =
  lang    === 0 ? "你这家伙！在用MTool吧！？" :
  lang    === 1 ? "きさま！MToolを使っているなッ！？" :
                  "You’re using MTool, aren’t you?!";

  let textArray = [
    line0,
    "･･･@@@::･･････････････",
    "･･(・`ω´・)::･･････^‿^＝つ≡⊃",
    "/⌒　　⌒)::　(｀Д´)=つ≡⊃",
    "/^＼＿　/ /::　(っ　≡つ=⊃",
    "(＿＼＼ 彡):: |　　 /",
    "｜ ‐イ::　(ヽノ",
    "/ y　)::　ﾉ>ノ",
    "//　/::　レレ",
    "／　 /::　ゴ ゴ ゴ ゴ ゴ ゴ ゴ ",
    "(　く::",
    "|＼ ｀::"
  ];


  let warns =
    lang === 0 ? [
      "", 
      "警告：MTool 会修改游戏底层代码，可能导致不可预料的错误。",
      "为了稳定性，请在修改数据后尽快关闭 MTool！"
    ] :
    lang === 1 ? [
      "",
      "警告：MTool はゲームのコアコードを改変し、予期せぬ不具合を招く可能性があります。",
      "安定性のため、データ編集後は速やかに MTool を終了してください！"
    ] : [
      "",
      "Warning: MTool modifies the game’s core code and may cause unpredictable errors.",
      "For stability, please close MTool promptly after editing your data!"
    ];
  textArray.push.apply(textArray, warns);

  let text = textArray.join("\n");
  alert(text, { width: 420, align: "left" });
};

// 监听装备效果影响
QJ.MPMZ.tl._imoutoUtilListenEquipEffectImpact = function() {
	
	if (!this) return;
	
	// 是否强制进入贤者模式
	if ( $gameParty.leader().hasSkill(61) ) {
	  if (!this._skillEffect61) {
		$gameVariables.setValue(25, -10);
	  }
	}	
	
};

// 自动更新提醒图标
QJ.MPMZ.tl._imoutoUtilautoUpdataIcon = function() {
   	
	if (!SceneManager._scene || !(SceneManager._scene instanceof Scene_Map)) return;
	if ($gameMap.mapId() !== 4) return;
	if ($gameScreen.picture(81)) return;
	if ($gameSwitches.value(28)) return;

	if ($gameMap.isEventRunningQJ()) {
	   setTimeout(() => QJ.MPMZ.tl._imoutoUtilautoUpdataIcon(), 2000);
	   return;
	}
	
	var IMG = "autoUpdataIcon";
	$gameScreen.showPictureFromPath(81, "characters", IMG, 0, 388, 360, 100, 100, 0, 0);
	IMG = $gameScreen.picture(81);
	// 更新提示音
	AudioManager.playSe({name: "038myuu_YumeSE_FukidashiOnnpu01", volume: 80, pitch: 100, pan: 0});
	
	if (IMG) {
    $gameScreen.movePicture(81, IMG.origin(), IMG.x(), IMG.y(), IMG.scaleX(), IMG.scaleY(), 255, 0, 30);
    IMG.drill_PCE_stopEffect();
	IMG.drill_PCE_playSustainingFloating( 518400000,1,1,120,3 );
	$gameScreen.setPictureCallCommon(81, 40, 1,null);
	}	
	
};

// 游戏公告提醒图标
QJ.MPMZ.tl._imoutoUtilGameAnnouncementIcon = function() {
   	
	if ($gameScreen.picture(82)) return;
    if ($gameMap.mapId() !== 4) return;
	if (!$gameScreen.picture(1) || !$gameScreen.picture(1).name().includes("sister_room_night_fine"))  return;
	if ($gameVariables.value(82) === $gameSystem.day()) return;
	
    if ( $gameStrings.value(25) === $gameStrings.value(26) )  return;
	
	if ($gameMap.isEventRunningQJ()) {
	   setTimeout(() => QJ.MPMZ.tl._imoutoUtilGameAnnouncementIcon(), 2000);
	   return;
	}
	$gameVariables.setValue(82, $gameSystem.day());
	
	var pid = 82;
	var IMG = "characters/gameAnnouncementIcon";
	$gameScreen.showPicture(pid, IMG, 0, 1498, 590, 100, 100, 0, 0);
	// 日记本
	$gameScreen.showPicture(pid+1, "sister_room_night_diary", 0, 1488, 644, 100, 100, 0, 0);
	var diary = $gameScreen.picture(pid+1);
	
	IMG = $gameScreen.picture(pid);
	// 更新提示音
	AudioManager.playSe({name: "038myuu_YumeSE_FukidashiOnnpu01", volume: 80, pitch: 100, pan: 0});
	// 绑定点击监听器
	if (IMG) {
		
       QJ.MPMZ.Shoot({
           groupName:["AnnouncementIcon","imoutoUtilIcon"],
           img: ['pictures',"characters/gameAnnouncementIcon"],
	       initialRotation:['S',0],
           position:[['S',IMG.x()+35],['S',IMG.y()]],
	       z:"A",
	       blendMode:0,
           imgRotation:['S',0],
	       moveType: ['S',0],
           opacity:'0|0~30/1~999999|1',
	       scale:1,
	       collisionBox:['C',24],
	       anchor:[0.56,0.55],
           existData:[ 
	          { t: ['S', '!this._activated', false], d: [1, 30, 1.5], a: ["S","SoundManager.playOk();$gameMap.steupCEQJ(41,1,{optionFunction:true})"] }
	       ],
	       moveJS:[
	             [20,20,`if ($gameMessage.isBusy()||$gameMap.isAnyEventStartingQJ()) {
					       if (!this._changed) {
                              this.changeAttribute('opacity','0|1~20/0~999999|0');
						      this._changed = true;
                           }
				        } else {
					       if (this._changed) {
                              this.changeAttribute('opacity','0|0~30/1~999999|1');
						      this._changed = false;
                           }							
						}
				 `]
	       ],
           timeline:['S',0,120,[180,5,60]],
       });		
	}	

	if (diary) {
    $gameScreen.movePicture(pid+1, diary.origin(), diary.x(), diary.y(), diary.scaleX(), diary.scaleY(), 255, 0, 30);
	diary.drill_PLAZ_setZIndex( 2 );	
	}	
};

// 监听妹妹好感条消失
QJ.MPMZ.tl._imoutoUtilkokanBarFades = function() {
	
	//蜜汁BUG
	$gameSwitches.setValue(3, false);
    let Imouto = $gameActors.actor(2);
	// 立绘状态bar淡出消失
	if ([23,24,25,26].some(stateId => Imouto.isStateAffected(stateId))) {
	$gameSystem._drill_GFV_bindTank[5].visible = false;
	$gameSystem._drill_GFV_bindTank[6].visible = false;
	$gameSystem._drill_GFV_bindTank[7].visible = false;
	$gameSystem._drill_GFV_bindTank[8].visible = false;
	$gameTemp._drill_GFV_needRefresh = true
	}
    // 防范玩家鼠标权限始终未返还
    if ( !$gameSystem._drill_COI_map_mouse ) {
		$gameSystem._drill_COI_map_mouse = true;
	}
	
	// 粉色糖果状态监听
	if (!$gameSystem.hasGameTimeEvent('state35')) {
		Imouto.removeState(35);
	}
	// 犯困状态监听
	if (!$gameSystem.hasGameTimeEvent('state36')) {
		Imouto.removeState(36);
	}	
	// 饱腹状态监听
	if (!$gameSystem.hasGameTimeEvent('state41')) {
		Imouto.removeState(41);
	}	
	
};

//在家里监听呼叫妹妹过来操作
QJ.MPMZ.tl._imoutoUtilCallSisterOver = function() {
	
	this._coolDown = this._coolDown || 0; 
	if (this._coolDown > 0) this._coolDown -= 1;

		                                                                                            //  鼠标位于哥哥HP条上的情形
	let forbid1 = $gameMessage.isBusy() || $gameMap.isEventRunningQJ() || $gameSwitches.value(14) || $gameScreen.isPointerInnerPicture(81);
	// 必须是坐着的妹妹小人才适配该功能
	let Imouto = $gameScreen.picture(5);
	let forbid2 = Imouto && 
	              Imouto._opacity > 250 && 
				  (Imouto?.name().includes("sis_chibi_normal") || Imouto?.name().includes("dozingOff") || Imouto?.name().includes("angryImouto") || Imouto?.name().includes("inHeat"));
	// 触发睡眠事件
	let forbid3 = $gameSelfSwitches.value([$gameMap.mapId(), 42, 'A']) || $gameSelfSwitches.value([$gameMap.mapId(), 15, 'D']);
	
	if ( forbid1 || !forbid2 ) {
		  if ( !document.body.style.cursor.includes("pointer_touch") ) {
		     CustomCursor.reset();
		  }
		return;
	} else {
		if (!$gameSwitches.value(46)) CustomCursor.setType('pointer');
	}

    if (forbid3) {
		CustomCursor.reset();
		return;		
	}
	
	//let rectX = TouchInput.x > 256 && TouchInput.x < 560;
	//let rectY = TouchInput.y > 393 && TouchInput.y < 872;	
	if ( !$gameScreen.isPointerInnerPicture(5) ) {
		CustomCursor.setType('pointer');
	} else {
		CustomCursor.reset();
		return;
	}
	if (Utils.isMobileDevice()) {
		  // 移动端适配，点击图标有效，但长按才能呼叫妹妹
		  if (!TouchInput.isPressed()) return;
		  let Triggerd = QJ.MPMZ.rangeAtk([['M'],['M']],['B','imoutoUtilIcon'],['S',"bulletTarget._activated=true"],['C',20]).length;
		  if (TouchInput._pressedTime < 24) return;
  		  // 玩家一直按着屏幕	
		  if ( Triggerd == 0 ) {
			$gameMap.event(15).steupCEQJ(4);
    	    this._coolDown = 50;
		  }		
	} else {
       if ( TouchInput.drill_isLeftTriggerd() || TouchInput.drill_isLeftPressed() ) {		
			// 为点击判定追加图标响应器			
		  if ( QJ.MPMZ.rangeAtk([['M'],['M']],['B','imoutoUtilIcon'],['S',"bulletTarget._activated=true"],['C',2]).length == 0 ) {
			$gameMap.event(15).steupCEQJ(4);
    	    this._coolDown = 50;
		  }
	   }		  
   	}
};

//在家里常态隐藏体力hud监听器
QJ.MPMZ.tl._imoutoUtilOniiChansHpBarFades = function() {
	let player = $gameParty.leader();
    this._UIcoolDown = this._UIcoolDown || 0;
	this._playerHp = this._playerHp || player.hp;
	this._stateList = this._stateList || player.states().length;

    if (this._UIcoolDown === 0) {
        let neddFade = QJ.MPMZ.tl._imoutoUtilOniiChansHpBarFadesInAndOut();
		
        if (this._playerHp !== player.hp)	{
			this._playerHp = player.hp;
            neddFade = true;
		}			
        if (this._stateList !== player.states().length) {
			this._stateList = player.states().length;
            neddFade = true;
		}
		
        if (!neddFade) {
            if ($gameSystem._ahud_visible) {
                // 设置延迟倒计时
                this._UIcoolDown = 4;
            } else {
                $gameSystem._ahud_visible = false;
            }
        } else {
            $gameSystem._ahud_visible = true;
        }
    } else {
        this._UIcoolDown -= 1;
        if (this._UIcoolDown === 0) {
            $gameSystem._ahud_visible = false;
        } else {
            $gameSystem._ahud_visible = true;
        }
    }

	let value = 90;
	if ( AudioManager._currentBgm )  value = AudioManager._currentBgm.volume;	
	// Alt键快进监听
	if ( $gameTemp.drill_OKe_isSpeedGearPressed() && !$gameTemp._disableFastForward ) {
		if (!this._speedGear) {
			this._speedGear = true;
			Garasu_EnfriarPantalla(120);
			Garasu_ModBGM(125, value, 0);
		}
	} else {
		Garasu_Descongelar();
		if (this._speedGear)  Garasu_ModBGM(100, value, 0);
		this._speedGear = false;
	}
	
};

//体力hud淡入淡出
QJ.MPMZ.tl._imoutoUtilOniiChansHpBarFadesInAndOut = function() {
    let hud = SceneManager._scene._actorHud;
    if (hud._hud_size[0] === -1) {return false};
	if (!hud._battler) {return false};
	if (TouchInput.x < hud._hud_size[0]) {return false};
	if (TouchInput.x > hud._hud_size[2]) {return false};
	if (TouchInput.y < hud._hud_size[1]) {return false};
	if (TouchInput.y > hud._hud_size[3]) {return false};	   

    return true;
};


// 妹妹强制睡眠时间监听
QJ.MPMZ.tl._imoutoUtilSleepEventListener = function() {
    const mapId  = $gameMap.mapId();
    const Imouto = $gameActors.actor(2);
    if (![4,54].includes(mapId)) return;
	// 夜袭场景不触发
	if (mapId == 4 && !$gameScreen.picture(1)?.name?.().includes("night_fine")) return;
    // 洗澡立绘不触发（需要考虑亲密接触的情况）
    //if (Imouto.isStateAffected(25) && !$gameSwitches.value(46)) return;

    // 计算当前时刻（单位：总分钟）
    const currentDay       = $gameSystem.day();
    const hour             = $gameSystem.hour();
    const minute           = $gameSystem.minute();
    const currentMinutes   = currentDay * 1440 + hour * 60 + minute;
    let finalTargetMinutes = $gameVariables.value(3);
	if (finalTargetMinutes == 0) {
		finalTargetMinutes = QJ.MPMZ.tl._imoutoUtilCalculateFinalTargetMinutes({force:true});
	}
    // 最优先检查： 连续吃掉两颗蓝色金平糖
	const blueKonpeito = Imouto.isStateAffected(36) && $gameVariables.value(19) < 0;
	if ( blueKonpeito ) $gameSelfSwitches.setValue([4, 42, 'A'], true);

    // 第一重检查：限定在22:00～23:59或0:00～6:00的时间段内
    if (!(hour >= 22 && hour <= 23) && !(hour >= 0 && hour <= 6)) {
        return;
    }


    // 若当前时间已到达或超过目标时间，则触发强制睡眠事件
    if ( currentMinutes >= finalTargetMinutes ) {
		
      // 第二重检查：如果妹妹正在洗澡不触发（需要考虑亲密接触的情况）
      if (Imouto.isStateAffected(29) || $gameSelfSwitches.value([$gameMap.mapId(), 14, 'A'])) {
		  if ($gameSwitches.value(46)) {
            QJ.MPMZ.deleteProjectile('skinshipListeners', { a: ['S', `CustomCursor.reset();
			            $gameSwitches.setValue(46, false);
						$gameScreen.picture(20)?.drill_PDr_setCanDrag( false );
			            if ($gameActors.actor(2).isStateAffected(23)) {
							let eid = $gameMap.mapId() === 54 ? 9 : 50;
							$gameMap.event(eid).steupCEQJ(2);
						} else {
							$gameMap.event(18).steupCEQJ(1);
						}
							`] });
		    }							
          return;
      }		
      if ([4,54].includes(mapId)) {
          $gameSelfSwitches.setValue([4, 42, 'A'], true);
          $gameTemp._ImoutoForcedRest = true;
	  }
    }
};


// 计算强制睡眠时间
QJ.MPMZ.tl._imoutoUtilCalculateFinalTargetMinutes = function(extra={}) {
    let extend = $gameSelfVariables.value([1, 2, 'healing']);
      	extend = Math.min(extend,7);
    const baseMinutes = 22 * 60; // 22点为1320分钟
    const extendMinutes = extend * 30; // 每extend增加30分钟

    let targetMinutes = baseMinutes + extendMinutes;
    let targetDay;
	
	if ($gameSystem.hour() > 15 && !extra.force) {
      targetDay = $gameSystem.day() + 1;
	} else {
	  targetDay = $gameSystem.day();
	}

    // 若超过1440则跨天
    while (targetMinutes >= 1440) {
        targetMinutes -= 1440;
        targetDay += 1;
    }

    const finalTargetMinutes = targetDay * 1440 + targetMinutes;
    $gameVariables.setValue(3, finalTargetMinutes);
	return finalTargetMinutes;
};


QJ.MPMZ.tl._imoutoUtilSceneNameDisplay = function(text) {
  if (!text) return;

  const zoom = $gameScreen.zoomScale();
  const invZoom = 1 / zoom;

  // --- 文字 ---
  const labelX = 1920 * invZoom;
  const labelY = 180 * invZoom;
  const labelScale = invZoom;

  const bulletText = `✦${text}`;

  const textStyle = {
    text: bulletText,
    arrangementMode: 0,
    textColor: "#aeadad",
    fontSize: 26,
    outlineColor: "#000000",
    outlineWidth: 0,
    fontFace: "MPLUS2ExtraBold",
    fontItalic: false,
    fontBold: true,
    width: 300,
    height: 100,
    textAlign: 6,
    lineWidth: 0,
    lineColor: "#ffffff",
    lineRate: 1.0,
    backgroundColor: null,
    backgroundOpacity: 1,
    shadowBlur: 8,
    shadowColor: "#000000",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  };

  QJ.MPMZ.Shoot({
    img: ['T', textStyle],
    position: [['S', labelX], ['S', labelY]],
    initialRotation: ['S', 0],
    imgRotation: ['F'],
    moveType: ['S', 0],
    opacity: 1,
    z: "A",
    scale: labelScale,
    onScreen: true,
    anchor: [1, 1],
    existData: [],
  });

  // --- 装饰线 ---
  const lineX = 1930 * invZoom;
  const lineY = 152 * invZoom;
  const lineScale = [0.5 * invZoom, 0.5 * invZoom];

  QJ.MPMZ.Shoot({
    img: "line",
    position: [['S', lineX], ['S', lineY]],
    initialRotation: ['S', 0],
    imgRotation: ['F'],
    moveType: ['S', 0],
    opacity: 1,
    z: "A",
    scale: lineScale,
    onScreen: true,
    anchor: [1, 1],
    existData: [],
  });
};


QJ.MPMZ.tl._imoutoUtilScenesymbolDisplay = function(extraText) {
	const zoom = $gameScreen.zoomScale?.() || 1;
	let scaleX = 0.5   / zoom;
	let scaleY = 0.5   / zoom;
	let posX   = 1930  / zoom;
    let posY   = 152   / zoom;
        QJ.MPMZ.Shoot({
            img:"line",
            position: [['S',posX], ['S',posY]],
            initialRotation: ['S', 0],
            imgRotation: ['F'],
			scale:[scaleX,scaleY],
            opacity: 1,
			anchor:[1,1],
			onScreen:true,
            moveType: ['S', 0],
            z:"A",
            existData: [
			],
        });		
};

// 摸妹妹头好感奖励
QJ.MPMZ.tl._imoutoUtilPatPatEffect = function() {

    let baseArray = [1, 2, 3, 4, 5];

    let level = $gameParty.leader().skillMasteryLevel(61);
    if (level > 0) {
        baseArray = baseArray.map(n => Math.round((n * 1.3 ** level) + level));
    }

    let weights = chahuiUtil.getImoutoMoodReaction();
    let random = chahuiUtil.gachaWeightedRandom(baseArray, weights);

    let koukan = $gameVariables.value(17) + random;
    $gameVariables.setValue(17, koukan);

    let index = baseArray.indexOf(random);
    index += 1;
    return index;
};


// 快捷摸头妹妹反应文字
QJ.MPMZ.tl._imoutoUtilMoodText = function(randomIndex) {
	
	let posX,posY; 
	if ($gameVariables.value(1) < 2) {
    do {
        posX = 320 + Math.randomInt(200); 
    } while (posX >= 380 && posX <= 460); // 排除范围	
        posY = 500 + Math.randomInt(200);
	} else {
		posX = 500 + Math.randomInt(80);
		posY = 450;
	}
	
	let textSize,textFace;
	let type = 1;
	let moveSpeed = '0|0.5~120/0.01~999/0.01';

    let textArray = window.MapEventDialogue4?.quickHeadpat;
      if (!textArray) {
        textArray = [
            "My hair will get messy!", 
			"Don’t pat it too much!", 
			"Feels nice", 
			"A little longer?", 
			"Meow..."
	    ];
      }
	switch (ConfigManager.language) {
        case 0:
		  textSize = 24;
		  textFace = DrillUp.g_DFF_fontFace;
		  break;
        case 1:
		  textSize = 20;
		  textFace = "RiiTegakiFude";		
		  break;
        case 2:
		  textSize = 24;
		  textFace = "RiiTegakiFude";	
          type     = 0;			  
        default:
		  textSize = 24;
		  textFace = DrillUp.g_DFF_fontFace;
          type     = 0;		  
		  break;
	}
	
	if (!randomIndex) randomIndex = 1;
	randomIndex -= 1;
    let BulletText = textArray[randomIndex];
	
        QJ.MPMZ.Shoot({
            img:['T',{
    text:BulletText,
    arrangementMode:type,
    textColor:"#e1e1e1",
    fontSize:textSize,
    outlineColor:"#000000",
    outlineWidth:0,
    fontFace:textFace,
    fontItalic:false,
    fontBold:true,
    width:-1,
    height:-1,
    textAlign:5,
    lineWidth:0,
    lineColor:"#ffffff",
    lineRate:1.0,
    backgroundColor:null,
    backgroundOpacity:1,
    shadowBlur:4,
    shadowColor:"#000000",
    shadowOffsetX:0,
    shadowOffsetY:0
}],
            position: [['S',posX], ['S',posY]],
            initialRotation: ['S', 0],
            imgRotation: ['F'],
            opacity:'0|1~30|1~90/0',
            moveType:['S',moveSpeed],
            z:"A",
			onScreen:true,
			anchor:[1,1],
            existData: [
		      {t:['Time',120]}
			],
        });		
};

// 妹妹好感度变化演出
QJ.MPMZ.tl._imoutoUtilKoukanLevelChange = function() {
	let posX = $gameSystem._drill_GFV_bindTank[7].frame_x;
	posX += 5 + Math.randomInt(50);
    let posY = $gameSystem._drill_GFV_bindTank[7].frame_y;
	posY -= Math.randomInt(10);
	
	let hearts = $gameVariables.value(15);
	let currentKoukan = $gameVariables.value(17);
	let totalKoukan = $gameVariables.value(12);
	let accumulatedKoukan = 100 * (hearts * (hearts + 1)) / 2 + currentKoukan;
	let difference = accumulatedKoukan - totalKoukan;
	if (difference <= 0) {
		$gameVariables.setValue(12, accumulatedKoukan);
		return;
	}
    let BulletText = "+" + difference;
	$gameVariables.setValue(12, accumulatedKoukan);
	
        QJ.MPMZ.Shoot({
            img:['T',{
    text:BulletText,
    arrangementMode:0,
    textColor:"#e1e1e1",
    fontSize:20,
    outlineColor:"#e53789",
    outlineWidth:0,
    fontFace:"RiiTegakiFude",
    fontItalic:false,
    fontBold:true,
    width:64,
    height:32,
    textAlign:6,
    lineWidth:0,
    lineColor:"#ffffff",
    lineRate:1.0,
    backgroundColor:null,
    backgroundOpacity:1,
    shadowBlur:5,
    shadowColor:"#d1075b",
    shadowOffsetX:0,
    shadowOffsetY:0
}],
            position: [['S',posX], ['S',posY]],
            initialRotation: ['S', 0],
            imgRotation: ['F'],
            opacity:'0|1~30|1~60/0',
            moveType:['S','0|0.5~90/0.01~999/0.01'],
            z:"A",
			scale:1,
			onScreen:true,
			anchor:[1,1],
            existData: [
		      {t:['Time',90]}
			],
        });		
};


// 妹妹选择饮料互动反应
QJ.MPMZ.tl._imoutoUtilSelectDrinkResponse = function () {

  this._coolDown = this._coolDown || 0;
  if (this._coolDown > 0) {
    this._coolDown--;
    return;
  }

  const scene    = SceneManager._scene;
  const msgWin   = scene && scene._messageWindow;
  const itemWin  = msgWin  && msgWin._itemWindow;

  if (!itemWin || !itemWin.active) {
    this.setDead({ t: ['Time', 0] });
    return;
  }

  const item = itemWin.item();        
  if (!item || typeof item.id !== 'number') return;

  /* 切换选中物品时，出现互动内容 */
  this._selected = this._selected || 0;
  if (this._selected === item.id) return;   

  this._selected = item.id;
  // 未实装，不生效
  //$gameMap.event(44).steupCEQJ(4, { selectedId: item.id });

  this._coolDown = 3;    
};

// 妹妹服装重置
QJ.MPMZ.tl._imoutoUtilImoutoOutfitReset = function() {
	
	let imouto = $gameActors.actor(2);
	// 复原胖次
	const panties = imouto.equips()[1];
	if (!panties?.name?.trim()) {
		 let array = [154, 155, 156];
		 let newPanties = array[Math.floor(Math.random() * array.length)];
		 imouto.changeEquipById(2, newPanties);
	}	
	// 复原睡衣和短裤
	imouto.changeEquipById(3, 152);
    imouto.changeEquipById(4, 153);
	
	//清除掉背包中残留的妹妹装备
	let armorIdsToRemove = [152,153,154,155,156,157,158,159];
	let armors = $gameParty.allItems().filter(function(item) {
        return item && DataManager.isArmor(item) && armorIdsToRemove.includes(item.baseItemId);
	});
	armors.forEach(function(armor) {
        $gameParty.loseItem(armor, 1);
	});	
	
};

// 妹妹自定义浮现文字
QJ.MPMZ.tl._imoutoUtilCustomMoodText = function (posX, posY, text) {
  QJ.MPMZ.deleteProjectile('moodText');

  let textSize = 24;
  let textFace = DrillUp.g_DFF_fontFace;
  let type = 1;
  let moveSpeed = '0|0.5~120/0.01~999/0.01';

  if (ConfigManager.language === 1) {
    textSize = 20;
    textFace = 'RiiTegakiFude';
  }

  if (ConfigManager.language > 1) {
    type = 0;
    moveSpeed = 0;
  }

  const BulletText = text;

  QJ.MPMZ.Shoot({
    img: [
      'T',
      {
        text: BulletText,
        arrangementMode: type,
        textColor: '#e1e1e1',
        fontSize: textSize,
        outlineColor: '#000000',
        outlineWidth: 0,
        fontFace: textFace,
        fontItalic: false,
        fontBold: true,
        width: -1,
        height: -1,
        textAlign: 5,
        lineWidth: 0,
        lineColor: '#ffffff',
        lineRate: 1.0,
        backgroundColor: null,
        backgroundOpacity: 1,
        shadowBlur: 4,
        shadowColor: '#000000',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
      },
    ],
    position: [
      ['S', posX],
      ['S', posY],
    ],
    initialRotation: ['S', 0],
    imgRotation: ['F'],
    groupName: ['moodText'],
    opacity: '0|1~30|1~90/0',
    moveType: ['S', moveSpeed],
    z: 'A',
    onScreen: true,
    anchor: [1, 1],
    existData: [{ t: ['Time', 120] }],
  });
};





//场景提醒图标
QJ.MPMZ.tl._imoutoUtilNotificationIcon = function(path,index,posX,posY) {

 let iconImg = "imoutoUtil/" + path;
 let radius = ['C',24];
 if (path == "button_passTime") radius = ['R',800,1080];
 let tag = "button" + index;
 
 let iconScale = 1;
 if (Utils.isMobileDevice()) iconScale = 1.5;
 var icon = QJ.MPMZ.Shoot({
    groupName:["button",tag],
    img:iconImg,
	initialRotation:['S',0],
    position:[['S',posX],['S',posY]],
	z:"A",
    imgRotation:['S',0],
	moveType: ['S',0],
	scale:iconScale,
    opacity:'0|0~30/1~99999|1',
	collisionBox:radius,
	anchor:[0.56,0.55],
    existData:[ 
	],
	moveF:[
	  [180,10,QJ.MPMZ.tl._imoutoUtilIconOpacityChange,[index]],
	],
    timeline:['S',0,120,[180,5,60]],
   });	
  
   if (index == 4) {
	  icon.addMoveData("F",[60,1,QJ.MPMZ.tl._imoutoUtilIconClickDetection]);
   }
  
};

//图标不透明度变化监听
QJ.MPMZ.tl._imoutoUtilIconOpacityChange = function(index) {
	
    if (!index) return;
	if ($gameScreen.isPointerInnerPicture(index)) {
		if (this.opacity >= 1) {
	  this.changeAttribute("opacity",'0|1~30/0~99999|0');
		}
	} else {
		if (this.opacity <= 0) {
	  this.changeAttribute("opacity",'0|0~30/1~99999|1');
		}
	}
};

//图标点击判定
QJ.MPMZ.tl._imoutoUtilIconClickDetection = function() {
	
    if (TouchInput.drill_isLeftPressed() || TouchInput.drill_isLeftTriggered()) {
		
	 QJ.MPMZ.Shoot({
		groupName:['RaidoCheck'],
        img:"null1",
        position:[['M'],['M']],
        initialRotation:['S',0],
        moveType:['S',0],
        imgRotation:['F'],
        existData:[
            {t:['Time',2]},
			{t:['B',['button4']],a:['F',QJ.MPMZ.tl._imoutoUtilIconClickPanties],p:[-1,false,true],c:['T',0,10,true]},
        ],
		collisionBox:['C',2],
     });		
		
	}
};

// 亲密接触初始化
QJ.MPMZ.tl._imoutoUtilSkinship = function() {
	
	// 改变指针
	$gameSwitches.setValue(46, true);
	CustomCursor.setImg('img/pictures/pointer_touch.png');
	
    let ahoge = $gameScreen.picture(20);
    if (ahoge && !ahoge.drill_PDr_getDragController()) {
        ahoge.drill_COPWM_setPixelHoverEnabled(true);  // 像素级判定
        ahoge.drill_PDr_setCanDrag(true);                // 可拖拽
        ahoge.drill_PAS_addAdsorbType("卡牌A类");          // 添加吸附类型
        ahoge.drill_PAS_setPullOutEnabled(false);         // 拖拽后可脱离槽
        $gameScreen.drill_PAS_addSlot_ByIndex(1, 1300, 150, 0);
        ahoge.drill_PAS_doAdsorb1_ByIndex(1);
    }

    let Skinship = QJ.MPMZ.Shoot({
        img: "null1",
        groupName: ['skinshipListeners'],
        existData: [
            { t: ['SW', 46, false] },
            { t: ["S", "!$gameMessage.isBusy()&&(Input.isPressed('cancel')||TouchInput.isCancelled())", true], 
			  a: ["S", `CustomCursor.reset();
			            $gameSwitches.setValue(46, false);
						if ($gameScreen.picture(20)) $gameScreen.picture(20).drill_PDr_setCanDrag( false );
			            if ($gameActors.actor(2).isStateAffected(23)) {
							let eid = 50;
							if ($gameMap.mapId() === 54)  eid = 9;
							$gameMap.event(eid).steupCEQJ(2);
						} else {
							$gameMap.event(18).steupCEQJ(1);
						}
							`] 
			}
        ],
        moveF: [
            [30, 1, QJ.MPMZ.tl._imoutoUtilSkinshipAhogeDetection],
            [30, 1, QJ.MPMZ.tl._imoutoUtilSkinshipHitboxDetection]
        ]
        // deadJS: ["$gameMap.event(4).steupCEQJ(1)"]
    });
		
};

// 亲密接触摸呆毛判定
QJ.MPMZ.tl._imoutoUtilSkinshipAhogeDetection = function() {

	// 摸呆毛判定
	let ahoge = $gameScreen.picture(20);
    if ( $gameMessage.isBusy() || $gameSwitches.value(14) || $gameSwitches.value(32) || $gameSwitches.value(33) ) {
		
        if( ahoge ) {
          ahoge.drill_PDr_setCanDrag( false );
        }	 
		
	} else {
        if( ahoge ) {
          ahoge.drill_PDr_setCanDrag( true );
        }			
	}

	if ( !ahoge || $gameMessage.isBusy() || $gameSwitches.value(14) || $gameSwitches.value(32) || $gameSwitches.value(33) ) {
		
		if (ahoge){
          ahoge.drill_PDr_clearDragPosition();
		   
        }
		return;
	}
	
	let disX = ahoge.drill_PDr_getDraggingXOffset();
	let disY = ahoge.drill_PDr_getDraggingYOffset();
	let distance = Math.sqrt(disX ** 2 + disY ** 2);
	if (Math.abs(distance) > 6) {
		ahoge.drill_PDr_setCanDrag( false );
		$gameSwitches.setValue(14, true);
		$gameMap.steupCEQJ(37,1,{skipAchievement:true, ahogeDistance:disX});
		QJ.MPMZ.deleteProjectile('skinshipListeners');
		return;
	}
};


// 亲密接触部位判定
QJ.MPMZ.tl._imoutoUtilSkinshipHitboxDetection = function() {

	this._coolDown = this._coolDown || 0;
    this._idleTime = this._idleTime	|| 0;
	if (this._coolDown > 0) {
	   this._coolDown -= 1;
	   return;
	}
    // 流程锁，需主动解锁
    if (this._suspend) {
		return;
	}
    // 无操作判定
  if (!TouchInput.drill_isLeftPressed() && !$gameSwitches.value(14) && !$gameMap.isAnyEventStartingQJ()) {
	  this._idleTime += 1;
	  if (this._idleTime >= 60) {
		  this._coolDown = 5;
		  this._idleTime = 0;
		  if (!$gameScreen.picture(16) || $gameScreen.picture(16).name().includes("OAO")) return;
		       $gameScreen.showPicture(16, "mio_tachie_kao_OAO", 0, 1000, 150, 100, 100, 255, 0);
			   
			   const key   = "MapEventDialogue4";
               const table = window[key];
               const lines = table && table["4"] && table["4"]["3"];
			   if (Array.isArray(lines) && lines.length) {
                  const PREFIX = "\\dDCOG[11:2:2:2]\\fs[32]";
                  const text = PREFIX + lines.join();
			      $gameTemp.drill_GFTT_createSimple([1480, 215], text, 5, 9, 150);
			   }
			   
               AudioManager.playVoice(
                   { name: "sis_room_tachie_kimochi04", volume: 90, pitch: 100, pan: 0 },
                   false, 2
               );		   
		  return;
	  }
  }
    
	
	let Touching = false;
	// 移动端适配
	if ( Utils.isMobileDevice() ) {
		Touching = TouchInput.isPressed() || TouchInput.isTriggered();
	} else {
		Touching = TouchInput.drill_isLeftPressed() || TouchInput.drill_isLeftTriggered();
	}

	
  if ( Touching ) {
	  
	  this._idleTime = -60;
	
	if ($gameScreen.isPointerInnerPicture(20)) return;


    let Pressed = false;
	let Triggered = false;
	// 移动端适配,并细分触摸动作
	if ( Utils.isMobileDevice() ) {
		Pressed = TouchInput.isPressed(); 
		Triggered = TouchInput.isTriggered();
	} else {
		Pressed = TouchInput.drill_isLeftPressed(); 
		Triggered = TouchInput.drill_isLeftTriggered();
	}
	
	// 穿着T恤
	if ( $gameActors.actor(2).isStateAffected(23) && Pressed ) {
		
		if ( chahuiUtil.pointInPolygo('TshirtCollar') && TouchInput.isMoved() ) {
			 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触部位判定").length > 0) {
				 this._coolDown = 999;
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触部位判定")[0];
				 let eid = target._eventId;
				 AudioManager.playSe({ name: 'ポリエステルの布の衣擦れ_1', volume: 100, pitch:150, pan: 0 });
				 // 预加载
  				 for (let i = 1; i <= 5; i++) {
    				 ImageManager.loadPicture( `imoto_tachie/mio_tachie_T-shirt_draggingB${i}` );
					 ImageManager.loadPicture( `imoto_tachie/mio_tachie_boobShake${i+1}` );
  				 }				 
            	 QJ.MPMZ.Shoot({
                  	 existData: [ ],
                  	 moveF:[
                        	 [15,0,QJ.MPMZ.tl._imoutoUtilTuggingOnTshirt,["B"]]
                   	 ],
                  	 deadJS:[
                        `$gameMap.event(${eid}).steupCEQJ(3,{ImoutoReaction:"B"})`
                   	 ]
            	 });
    	         return;
             }			 
		}
		if ( chahuiUtil.pointInPolygo('TshirtHem') && TouchInput.isMoved() ) {
			 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触部位判定").length > 0) {
				 this._coolDown = 999;
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触部位判定")[0];
				 let eid = target._eventId;
				 AudioManager.playSe({ name: 'ポリエステルの布の衣擦れ_1', volume: 100, pitch:150, pan: 0 });
				 // 预加载
  				 for (let i = 1; i <= 4; i++) {
    				 ImageManager.loadPicture( `imoto_tachie/mio_tachie_T-shirt_draggingA${i}` );
  				 }				 
            	 QJ.MPMZ.Shoot({
                  	 existData: [ ],
                  	 moveF:[
                        	 [15,0,QJ.MPMZ.tl._imoutoUtilTuggingOnTshirt,["A"]]
                   	 ],
                  	 deadJS:[
                        `$gameMap.event(${eid}).steupCEQJ(3,{ImoutoReaction:"A"})`
                   	 ]
            	 });
    	         return;
             }
			 
		}		
	}

	
	// 摸头判定
    if ( chahuiUtil.pointInEllipse('tachieHead') && TouchInput.isMoved() ) {
		 this._coolDown = 5;
		 this._suspend = true;
		 $gameVariables.setValue(10, 0);
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触部位判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触部位判定")[0];
                     target.steupCEQJ(2);			 
		 }
         return;		 
	}
    // 乳头判定-左
    if ( chahuiUtil.pointInCircle('tachieLeftNipple') ) {
		 this._coolDown = 5;
		 this._suspend = true;
		 let type;
		 if ( TouchInput.isMoved() && Pressed ) {
           type = "stroke";
		 } else {
		   type = "poke";
		 }
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触判定")[0];
                     target.steupCEQJ(4,{actionType:type});			 
		 }		 
         return;	
	}
	// 乳头判定-右
    if ( chahuiUtil.pointInCircle('tachieRightNipple') ) {
		 this._coolDown = 5;
		 this._suspend = true;
		 let type;
		 if ( TouchInput.isMoved() && Pressed ) {
           type = "stroke";
		 } else {
		   type = "poke";
		 }
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触判定")[0];
                     target.steupCEQJ(4,{actionType:type});			 
		 }
         return;	
	}	
    // 揉胸判定-左
    if ( chahuiUtil.pointInCircle('tachieLeftBreast') && Pressed ) {
		 this._coolDown = 5;
		 this._suspend = true;
		 $gameVariables.setValue(10, 0);
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触判定")[0];
                     target.steupCEQJ(1);			 
		 }
         return;	
	}
    // 揉胸判定-右
    if ( chahuiUtil.pointInCircle('tachieRightBreast') && Pressed ) {
		 this._coolDown = 5;
		 this._suspend = true;
		 $gameVariables.setValue(10, 0);
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触判定")[0];
                     target.steupCEQJ(1);			 
		 }
         return;		
	}
    // 摸肚脐判定
    if ( chahuiUtil.pointInCircle('tachieNavel') && Pressed ) {
		 this._coolDown = 5;
		 this._suspend = true;
		 let type;
		 if (TouchInput.isMoved()) {
           type = "stroke";
		 } else {
		   type = "poke";
		 }
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触判定")[0];
                     target.steupCEQJ(5,{touchPoint:"navel",actionType:type});			 
		 }		 
         return;
	}
    // 小穴区域判定	
    if ( chahuiUtil.pointInPolygo('tachieOmanko') ) {
		 this._coolDown = 5;
		 this._suspend = true;
		 $gameVariables.setValue(10, 0);
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触判定")[0];
                     target.steupCEQJ(2);			 
		 }
         return;		 
	}	
    // 胖次区域判定	
    if ( !$gameActors.actor(2).equips()[3] && $gameActors.actor(2).equips()[1] !== undefined ) {
		if ( chahuiUtil.pointInPolygo('tachiePanties') ) {
		 this._coolDown = 5;
		 this._suspend = true;
		 $gameVariables.setValue(10, 0);
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触判定")[0];
                     target.steupCEQJ(2);			 
		 }
         return;	
        }		 
	}
    // 短裤区域判定	
    if ( $gameActors.actor(2).equips()[3] !== undefined ) {
		 if ( chahuiUtil.pointInPolygo('tachieShortpants') ) {
			 
		 }
	}	
    // 锁骨区域判定	
    if ( chahuiUtil.pointInPolygo('tachieClavicle') && Pressed ) {
		 this._coolDown = 5;
		 this._suspend = true;
		 let type;
		 if (TouchInput.isMoved()) {
           type = "stroke";
		 } else {
		   type = "poke";
		 }
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触判定")[0];
                     target.steupCEQJ(5,{touchPoint:"clavicle",actionType:type});			 
		 }		 
         return;		 
	}
    // 右耳区域判定	
    if ( chahuiUtil.pointInPolygo('tachieRightEar') && TouchInput.isMoved() ) {
		 this._coolDown = 5;
		 this._suspend = true;
		 let type;
		 if ( TouchInput.isMoved() && Pressed ) {
           type = "stroke";
		 } else {
		   type = "poke";
		 }
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触判定")[0];
                     target.steupCEQJ(5,{touchPoint:"ear",actionType:type});			 
		 }		 
		 return;
	}	
    // 左耳区域判定	
    if ( chahuiUtil.pointInPolygo('tachieLeftEar') && TouchInput.isMoved() ) {
		 this._coolDown = 5;
		 this._suspend = true;
		 let type;
		 if ( TouchInput.isMoved() && Pressed ) {
           type = "stroke";
		 } else {
		   type = "poke";
		 }
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触判定")[0];
                     target.steupCEQJ(5,{touchPoint:"ear",actionType:type});			 
		 }	
		 return;
	}
	// 未触发任何判定时，视为挠痒痒
	   if (TouchInput.isMoved() && Math.random() > 0.99 && $gameScreen.isPointerInnerPicture(11)) {
		 if ($gameMap.drill_COET_getEventsByName_direct("亲密接触判定").length > 0) {
				 let target = $gameMap.drill_COET_getEventsByName_direct("亲密接触判定")[0];
                     target.steupCEQJ(3);			 
		 }	
	   }
  }
};

QJ.MPMZ.tl.beginnersGuideTextPosition = {
	
	"guide0":{
		x: 420,
		y: 330,
		index: 0
	},	
	"guide1":{
		x: 960,
		y: 600,
		index: 1
	},
	"guide2":{
		x: 750,
		y: 600,
		index: 2
	},
	"guide3":{
		x: 1700,
		y: 290,
		index: 3
	},
	"mobileSaveReminder1":{
		x: 960,
		y: 500,
		index: 4
	},
	"mobileSaveReminder2":{
		x: 960,
		y: 500,
		index: 5
	},	
};

// 新手教程演出
QJ.MPMZ.tl._imoutoUtilBeginnersGuide = function(guideIndex) {
	
	var guide = QJ.MPMZ.tl.beginnersGuideTextPosition[guideIndex];
	if (!guide) return;

    var guideTextArray = window["MapEventDialogue4"]["beginnersGuide"][guide.index];

    var FontFace = DrillUp.g_DFF_fontFace;
    // 中文适配
    if (ConfigManager.language === 0) {
        FontFace = "Haiyanzhishidongdong";
    }
    // 中文适配
    if (ConfigManager.language === 1 || ConfigManager.language === 2) {
        FontFace = "RiiTegakiFude";
    }    
	let FontSize = 28;
    // 移动端适配
    if (Utils.isMobileDevice()) {
		guideTextArray = window["MapEventDialogue4"]["AndroidBeginnersGuide"][guide.index];
		FontSize = 32;
	}
    
	for (let i = 0; i < guideTextArray.length; i++) {
	
    // 文字和坐标
	var guideText = guideTextArray[i];
    var textPosX = guide.x;
    var textPosY = guide.y + (i * (FontSize + 4));

    QJ.MPMZ.Shoot({
        img: ['T', {
            text: guideText,
            textColor: "#ffffff",
            fontSize: 28,
            outlineColor: "#000000",
            outlineWidth: 0,
            fontFace: FontFace,
            fontItalic: false,
            fontBold: true,
			advanced: true,
            width: -1,
            height: -1,
            textAlign: 5,
            lineWidth: 0,
            lineColor: "#ffffff",
            lineRate: 1.0,
            backgroundColor: null,
            backgroundOpacity: 1,
            shadowBlur: 4,
            shadowColor: "#000000",
            shadowOffsetX: 0,
            shadowOffsetY: 0
        }],
        position: [['S', textPosX], ['S', textPosY]],
        initialRotation: ['S', 0],
        imgRotation: ['F'],
        groupName: ['BeginnersGuide',guideIndex],
        opacity: '0|0~60/1~30/1~60/0',
        scale: 1,
        moveType: ['S', 0],
        z: "A",
        existData: [
            //{ t: ['Time', 180] }
        ],
    });
  }
};
