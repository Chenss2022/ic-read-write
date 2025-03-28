if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  function formatAppLog(type, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type, filename, ...args);
    } else {
      console[type].apply(console, [...args, filename]);
    }
  }
  let NfcAdapter;
  let nfc;
  let nfcCallback;
  function createResponse(status, code, message, data = "", isClose) {
    if (isClose) {
      closeNFC();
    }
    return {
      status,
      code,
      message,
      data
    };
  }
  function initNFC(sector, block, key, dataToWrite = null, callback, isClose = false) {
    if (uni.getSystemInfoSync().platform == "android") {
      nfcCallback = callback;
      init(sector, block, key, dataToWrite, callback, isClose);
    }
  }
  function closeNFC() {
    nfcCallback = null;
    if (uni.getSystemInfoSync().platform == "android") {
      plus.globalEvent.removeEventListener("newintent");
      plus.globalEvent.removeEventListener("pause");
      plus.globalEvent.removeEventListener("resume");
      close();
    }
  }
  function init(sector, block, key, dataToWrite = null, callback, isClose) {
    try {
      let main = plus.android.runtimeMainActivity();
      let Intent = plus.android.importClass("android.content.Intent");
      let Activity = plus.android.importClass("android.app.Activity");
      let PendingIntent = plus.android.importClass("android.app.PendingIntent");
      let IntentFilter = plus.android.importClass("android.content.IntentFilter");
      NfcAdapter = plus.android.importClass("android.nfc.NfcAdapter");
      nfc = NfcAdapter.getDefaultAdapter(main);
      if (nfc == null) {
        uni.showToast({
          title: "设备不支持NFC！",
          icon: "none"
        });
        return;
      }
      if (!nfc.isEnabled()) {
        uni.showToast({
          title: "请在系统设置中先启用NFC功能！",
          icon: "none"
        });
        return;
      }
      let intent = new Intent(main, main.getClass());
      intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
      let pendingIntent = PendingIntent.getActivity(main, 0, intent, 0);
      let ndef = new IntentFilter("android.nfc.action.TECH_DISCOVERED");
      let tag = new IntentFilter("android.nfc.action.TAG_DISCOVERED");
      ndef.addDataType("*/*");
      let intentFiltersArray = [ndef, tag];
      let techListsArray = [
        ["android.nfc.tech.MifareClassic"],
        ["android.nfc.tech.MifareUltralight"]
      ];
      plus.globalEvent.addEventListener(
        "newintent",
        function() {
          readCardNo(sector, block, key, dataToWrite, callback, isClose);
        },
        false
      );
      plus.globalEvent.addEventListener("pause", function(e) {
        if (nfc) {
          nfc.disableForegroundDispatch(main);
        }
      }, false);
      plus.globalEvent.addEventListener("resume", function(e) {
        if (nfc) {
          nfc.enableForegroundDispatch(main, pendingIntent, intentFiltersArray, techListsArray);
        }
      }, false);
      nfc.enableForegroundDispatch(main, pendingIntent, intentFiltersArray, techListsArray);
    } catch (e) {
      formatAppLog("error", "at utils/ic-nfc.js:105", e);
    }
  }
  function readCardNo(sector, block, key, dataToWrite = null, callback, isClose) {
    let m1;
    try {
      let main = plus.android.runtimeMainActivity();
      let intent = main.getIntent();
      if ("android.nfc.action.TECH_DISCOVERED" == intent.getAction()) {
        let tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
        let MifareClassic = plus.android.importClass("android.nfc.tech.MifareClassic");
        m1 = MifareClassic.get(tag);
        m1.connect();
        if (m1.isConnected()) {
          let result = m1.authenticateSectorWithKeyA(sector, hexStringToByteArray(key));
          if (result) {
            let blockIndex = m1.sectorToBlock(sector);
            if (dataToWrite) {
              let hexDataToWrite = stringToHex(dataToWrite);
              let bytesToWrite = hexStringToByteArray(hexDataToWrite);
              m1.writeBlock(blockIndex, bytesToWrite);
              nfcCallback(createResponse(true, 200, "写入成功", dataToWrite, isClose));
            } else {
              let data = m1.readBlock(blockIndex);
              let cardNo = byteArrayToHexString(data);
              let StringCardNo = hexToString(cardNo);
              nfcCallback(createResponse(true, 200, "读取成功", StringCardNo, isClose));
            }
          } else {
            nfcCallback(createResponse(false, 0, "密钥认证错误", "", isClose));
            uni.showToast({
              title: "密钥认证错误",
              icon: "none"
            });
          }
        } else {
          nfcCallback(createResponse(false, 500, "寻卡失败", "", isClose));
          uni.showToast({
            title: "寻卡失败",
            icon: "none"
          });
        }
      }
    } catch (e) {
      uni.showToast({
        title: "读卡失败，点击后重新读卡",
        icon: "none"
      });
    } finally {
      if (m1 != null) {
        try {
          m1.close();
        } catch (e) {
          formatAppLog("log", "at utils/ic-nfc.js:165", "关闭标签失败");
        }
      }
    }
  }
  function close() {
    if (nfc) {
      let main = plus.android.runtimeMainActivity();
      nfc.disableForegroundDispatch(main);
    }
  }
  function hexStringToByteArray(key) {
    let hexA = new Array();
    let pos = 0;
    let len = key.length / 2;
    for (let i = 0; i < len; i++) {
      let s = key.substr(pos, 2);
      let v = parseInt(s, 16);
      if (v >= 128)
        v = v - 256;
      hexA.push(v);
      pos += 2;
    }
    return hexA;
  }
  function byteArrayToHexString(data) {
    let i, j, inn;
    let hex = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
    let out = "";
    for (j = 0; j < data.length; ++j) {
      inn = data[j] & 255;
      i = inn >>> 4 & 15;
      out += hex[i];
      i = inn & 15;
      out += hex[i];
    }
    return out;
  }
  function hexToString(hex) {
    let str = "";
    for (let i = 0; i < hex.length; i += 2) {
      let hexCode = hex.substr(i, 2);
      str += String.fromCharCode(parseInt(hexCode, 16));
    }
    return str.replace(/\u0000/g, "");
  }
  function stringToHex(str) {
    let hex = "";
    for (let i = 0; i < str.length; i++) {
      hex += str.charCodeAt(i).toString(16).padStart(2, "0");
    }
    return hex.padEnd(32, "0");
  }
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$1 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const readInfo = vue.ref("");
      const oneReadInfo = vue.ref("");
      const writeInfo = vue.ref("");
      function readCard() {
        uni.showToast({
          title: "如有ic卡可进行读卡操作！",
          icon: "none",
          duration: 1e3
        });
        initNFC(1, 4, "FFFFFFFFFFFF", null, (resp) => {
          readInfo.value = JSON.stringify(resp);
        });
      }
      function oneReadCard() {
        uni.showToast({
          title: "如有ic卡可进行读卡操作！",
          icon: "none",
          duration: 1e3
        });
        initNFC(1, 4, "FFFFFFFFFFFF", null, (resp) => {
          oneReadInfo.value = JSON.stringify(resp);
        }, true);
      }
      function writeCard() {
        if (writeInfo.value) {
          uni.showToast({
            title: "如有ic卡可进行写卡操作！",
            icon: "none",
            duration: 1e3
          });
          initNFC(1, 4, "FFFFFFFFFFFF", writeInfo.value, (resp) => {
            formatAppLog("log", "at pages/index/index.vue:61", resp);
            readInfo.value = JSON.stringify(resp);
          });
        } else {
          uni.showToast({
            title: "写入值不能为空",
            icon: "none",
            duration: 1e3
          });
        }
      }
      function oneWriteCard() {
        if (writeInfo.value) {
          uni.showToast({
            title: "如有ic卡可进行写卡操作！",
            icon: "none",
            duration: 1e3
          });
          initNFC(1, 4, "FFFFFFFFFFFF", writeInfo.value, (resp) => {
            formatAppLog("log", "at pages/index/index.vue:82", resp);
            readInfo.value = JSON.stringify(resp);
          });
        } else {
          uni.showToast({
            title: "写入值不能为空",
            icon: "none",
            duration: 1e3
          });
        }
      }
      const __returned__ = { readInfo, oneReadInfo, writeInfo, readCard, oneReadCard, writeCard, oneWriteCard, ref: vue.ref, get initNFC() {
        return initNFC;
      }, get closeNFC() {
        return closeNFC;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "content" }, [
      vue.createElementVNode(
        "view",
        null,
        "信息展示：" + vue.toDisplayString($setup.readInfo),
        1
        /* TEXT */
      ),
      vue.createElementVNode("button", { onClick: $setup.readCard }, "点击轮询读卡"),
      vue.createElementVNode(
        "view",
        null,
        "信息展示：" + vue.toDisplayString($setup.oneReadInfo),
        1
        /* TEXT */
      ),
      vue.createElementVNode("button", { onClick: $setup.oneReadCard }, "点击单次读卡"),
      vue.withDirectives(vue.createElementVNode(
        "input",
        {
          type: "text",
          "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.writeInfo = $event),
          style: { "border": "1px black solid" },
          placeholder: "输入"
        },
        null,
        512
        /* NEED_PATCH */
      ), [
        [vue.vModelText, $setup.writeInfo]
      ]),
      vue.createElementVNode("button", { onClick: $setup.writeCard }, "点击写卡"),
      vue.createElementVNode("button", { onClick: $setup.oneWriteCard }, "点击写卡")
    ]);
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__file", "F:/MYCODE/uniapp/ic-read/pages/index/index.vue"]]);
  __definePage("pages/index/index", PagesIndexIndex);
  const _sfc_main = {
    onLaunch: function() {
      formatAppLog("log", "at App.vue:4", "App Launch");
    },
    onShow: function() {
      formatAppLog("log", "at App.vue:7", "App Show");
    },
    onHide: function() {
      formatAppLog("log", "at App.vue:10", "App Hide");
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "F:/MYCODE/uniapp/ic-read/App.vue"]]);
  function createApp() {
    const app = vue.createVueApp(App);
    return {
      app
    };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
