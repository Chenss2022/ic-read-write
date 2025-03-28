<template>
	<view class="content">
		<view>信息展示：{{readInfo}}</view>
		<button @click="readCard">点击轮询读卡</button>
		
		<view>信息展示：{{oneReadInfo}}</view>
		<button @click="oneReadCard">点击单次读卡</button>
		
		<input type="text" v-model="writeInfo" style="border: 1px black solid;" placeholder="输入"/>
		<button @click="writeCard">点击写卡</button>
		<button @click="oneWriteCard">点击写卡</button>
	</view>
</template>

<script setup>
import { ref } from 'vue';
import {initNFC,closeNFC} from '../../utils/ic-nfc.js';



const readInfo = ref('');
const oneReadInfo = ref('');

const writeInfo = ref('');

// 轮询读卡
function readCard(){
	uni.showToast({
		title: '如有ic卡可进行读卡操作！',
		icon: 'none',
		duration: 1000,
	})
	initNFC(1,4,'FFFFFFFFFFFF',null,(resp)=>{
		// console.log(resp);
		readInfo.value = JSON.stringify(resp);
	})
}

// 单次读卡
function oneReadCard(){
	uni.showToast({
		title: '如有ic卡可进行读卡操作！',
		icon: 'none',
		duration: 1000,
	})
	initNFC(1,4,'FFFFFFFFFFFF',null,(resp)=>{
		// console.log(resp);
		oneReadInfo.value = JSON.stringify(resp);
	},true)
}

// 轮询写卡
function writeCard(){
	if(writeInfo.value) {
		uni.showToast({
				title: '如有ic卡可进行写卡操作！',
				icon: 'none',
				duration: 1000,
		})
		initNFC(1,4,'FFFFFFFFFFFF',writeInfo.value,(resp)=>{
			console.log(resp);
			readInfo.value = JSON.stringify(resp);
		})
	}else {
		uni.showToast({
				title: '写入值不能为空',
				icon: 'none',
				duration: 1000,
		})
	}
}

// 单次写卡
function oneWriteCard(){
	if(writeInfo.value) {
		uni.showToast({
				title: '如有ic卡可进行写卡操作！',
				icon: 'none',
				duration: 1000,
		})
		initNFC(1,4,'FFFFFFFFFFFF',writeInfo.value,(resp)=>{
			console.log(resp);
			readInfo.value = JSON.stringify(resp);
		})
	}else {
		uni.showToast({
				title: '写入值不能为空',
				icon: 'none',
				duration: 1000,
		})
	}
}
</script>

<style>
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
</style>
