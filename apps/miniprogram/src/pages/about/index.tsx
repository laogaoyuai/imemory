import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';

import { releaseConfig, releaseWarnings } from '../../config/release';
import { hasCurrentPrivacyConsent, openWechatPrivacyContract, readPrivacyConsent } from '../../privacy/privacy-consent';
import './index.css';

export default function AboutPage() {
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [platformContract, setPlatformContract] = useState('正在检查');
  const warnings = releaseWarnings();

  useDidShow(() => {
    setAcceptedAt(hasCurrentPrivacyConsent() ? readPrivacyConsent()?.acceptedAt ?? null : null);
    if (typeof Taro.getPrivacySetting !== 'function') {
      setPlatformContract('当前基础库不支持检查');
      return;
    }
    Taro.getPrivacySetting({
      success: (result) => setPlatformContract(result.needAuthorization ? `待同意 · ${result.privacyContractName}` : `已同意或无需授权 · ${result.privacyContractName || '微信隐私保护指引'}`),
      fail: () => setPlatformContract('检查失败，请在真机重试'),
    });
  });

  const openContract = async () => {
    if (!await openWechatPrivacyContract()) {
      await Taro.showToast({ title: '请在微信真机中查看', icon: 'none' });
    }
  };

  return (
    <View className="atlas-page atlas-safe-bottom about">
      <View className="about__hero"><Text className="about__eyebrow">ATLAS · {releaseConfig.version}</Text><Text className="about__title">关于拾光内容库</Text><Text className="about__copy">用于记录、整理、同步和协作分享个人内容。</Text></View>

      <View className="about__card">
        <Text className="about__section-title">我们处理的信息</Text>
        <Text className="about__paragraph">登录时处理微信登录临时凭证与账号标识；云端功能会保存你主动填写的名称、简介、内容、附件、项目、合集、评论和互动记录；服务端安全日志会记录请求时间、结果、请求标识和网络地址。</Text>
        <Text className="about__paragraph">这些信息用于账号识别、跨设备同步、协作、分享、安全防护和故障定位。未登录内容默认只保存在当前设备，主动登录并同步后才会上传。</Text>
      </View>

      <View className="about__card">
        <Text className="about__section-title">权限与选择</Text>
        <Text className="about__paragraph">只有在你选择图片、视频、会话文件或录音时才会调用对应微信能力；录音会申请麦克风权限，拒绝不会影响纯文字和本地浏览。公开内容可被其他用户查看和分享，私密及未通过审核的内容继续由服务端执行访问控制。</Text>
        <View className="about__status"><Text>微信隐私指引</Text><Text>{platformContract}</Text></View>
        <View className="about__status"><Text>登录知情同意</Text><Text>{acceptedAt ? formatTime(acceptedAt) : '尚未同意'}</Text></View>
        <Button className="about__primary" onClick={() => void openContract()}>查看微信隐私保护指引</Button>
      </View>

      <View className="about__card">
        <Text className="about__section-title">联系与发布诊断</Text>
        <View className="about__status"><Text>运行环境</Text><Text>{releaseConfig.environment}</Text></View>
        <View className="about__status"><Text>隐私联系人</Text><Text>{releaseConfig.privacyContact || '尚未配置'}</Text></View>
        {warnings.length > 0 ? warnings.map((warning) => <Text className="about__warning" key={warning}>待处理 · {warning}</Text>) : <Text className="about__ready">生产配置检查通过</Text>}
      </View>
    </View>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '已同意' : date.toLocaleString('zh-CN', { hour12: false });
}
