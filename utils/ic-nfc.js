let NfcAdapter;
let nfc;
let nfcCallback;

/**
 * 创建错误响应对象
 * @param {Boolean} status - 状态
 * @param {number} code - 错误代码
 * @param {string} message - 错误信息
 * @param {any} [data=''] - 错误数据（默认空字符串）
 * @param {Boolean} isClose - 是否只读一次，true是，默认不传为false，一直监听
 * @returns {object} - 返回格式化的错误响应对象
 */
function createResponse(status, code, message, data = '',isClose) {
	if(isClose){
		closeNFC();
	}
	return {
		status: status,
		code: code,
		message: message,
		data: data
	};
}

/**
 * 初始化NFC功能
 * @param {number} sector - 扇区编号
 * @param {number} block - 块编号
 * @param {number} key - 密钥
 * @param {string} [dataToWrite=null] - 要写入的数据（可选），如果提供数据，则执行写入操作
 * @param {Function} callback - 成功回调函数
 * @param {Boolean} isClose - 是否只读一次，true是，默认不传为false，一直监听
 */
export function initNFC(sector,block,key,dataToWrite=null,callback,isClose=false) {
	if (uni.getSystemInfoSync().platform == 'android') {
		nfcCallback = callback;
		init(sector,block,key,dataToWrite,callback,isClose);
	}
}

export function closeNFC() {
	nfcCallback = null;
	if (uni.getSystemInfoSync().platform == 'android') {
		plus.globalEvent.removeEventListener("newintent");
		plus.globalEvent.removeEventListener("pause");
		plus.globalEvent.removeEventListener("resume");
		close();
	}
}

function init(sector,block,key,dataToWrite=null,callback,isClose) {
	try {
		let main = plus.android.runtimeMainActivity();
		let Intent = plus.android.importClass('android.content.Intent');
		let Activity = plus.android.importClass('android.app.Activity');
		let PendingIntent = plus.android.importClass('android.app.PendingIntent');
		let IntentFilter = plus.android.importClass('android.content.IntentFilter');
		NfcAdapter = plus.android.importClass('android.nfc.NfcAdapter');
		nfc = NfcAdapter.getDefaultAdapter(main);

		if (nfc == null) {
			uni.showToast({
				title: '设备不支持NFC！',
				icon: 'none'
			})
			return;
		}

		if (!nfc.isEnabled()) {
			uni.showToast({
				title: '请在系统设置中先启用NFC功能！',
				icon: 'none'
			});
			return;
		}

		let intent = new Intent(main, main.getClass());
		intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
		let pendingIntent = PendingIntent.getActivity(main, 0, intent, 0);
		let ndef = new IntentFilter("android.nfc.action.TECH_DISCOVERED");
		let tag = new IntentFilter('android.nfc.action.TAG_DISCOVERED');
		ndef.addDataType("*/*");
		let intentFiltersArray = [ndef, tag];
		let techListsArray = [
			["android.nfc.tech.MifareClassic"],
			["android.nfc.tech.MifareUltralight"]
		];
		plus.globalEvent.addEventListener("newintent",
			function() {
				readCardNo(sector,block,key,dataToWrite,callback,isClose);
			}, false);
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
		console.error(e);
	}
}

/**
 * 读取卡号
 */
function readCardNo(sector,block,key,dataToWrite=null,callback,isClose) {
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
						// 如果提供了数据，执行写入操作
						let bytesToWrite = hexStringToByteArray(hexDataToWrite); // 将字符串转换为字节数组
						m1.writeBlock(blockIndex, bytesToWrite);
						nfcCallback(createResponse(true, 200, "写入成功", dataToWrite,isClose));
					} else {
						// 否则执行读取操作
						let data = m1.readBlock(blockIndex);
						let cardNo = byteArrayToHexString(data);
						let StringCardNo = hexToString(cardNo);
						nfcCallback(createResponse(true, 200, "读取成功", StringCardNo,isClose));
					}
				}else{
					nfcCallback(createResponse(false, 0, "密钥认证错误",'',isClose));
					uni.showToast({
						title: "密钥认证错误",
						icon: 'none'
					});
				}
			}else{
				nfcCallback(createResponse(false, 500, "寻卡失败",'',isClose));
				uni.showToast({
					title: "寻卡失败",
					icon: 'none'
				});
			}
		}
	} catch (e) {
		uni.showToast({
			title: "读卡失败，点击后重新读卡",
			icon: 'none'
		});
	} finally {        
		if (m1 != null) {
			try {
				m1.close();
			} catch (e) {
				console.log("关闭标签失败");
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

//Key处理函数  
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

//数组转字符串
function byteArrayToHexString(data) {
	let i, j, inn;
	let hex = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
	let out = '';
	for (j = 0; j < data.length; ++j) {
		inn = data[j] & 0xff;
		i = (inn >>> 4) & 0x0f;
		out += hex[i];
		i = inn & 0x0f;
		out += hex[i];
	}
	return out;
}

/**
 * 将 HEX 字符串转换为普通字符串
 * @param {string} hex - HEX 字符串
 * @returns {string} - 返回普通字符串
 */
function hexToString(hex) {
	let str = '';
	for (let i = 0; i < hex.length; i += 2) {
		let hexCode = hex.substr(i, 2);
		str += String.fromCharCode(parseInt(hexCode, 16));
	}
	return str.replace(/\u0000/g, '');
}

/**
 * 将普通字符串转换为 HEX 字符串
 * @param {string} str - 普通字符串
 * @returns {string} - 返回 HEX 字符串
 */
function stringToHex(str) {
	let hex = '';
	for (let i = 0; i < str.length; i++) {
		hex += str.charCodeAt(i).toString(16).padStart(2, '0');
	}
	// 如果 hex 字符串长度小于 32，使用 padEnd 补齐
	return hex.padEnd(32, '0');
}