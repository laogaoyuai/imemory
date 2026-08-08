import i18next from 'i18next';

export const i18n = i18next.createInstance();

void i18n.init({
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
  resources: {
    'zh-CN': {
      translation: {
        'content.empty': '请输入文字或添加至少一个附件',
      },
    },
    en: {
      translation: {
        'content.empty': 'Add some text or at least one attachment',
      },
    },
  },
});
