export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/compose/index',
    'pages/content/detail',
    'pages/content/versions',
    'pages/collections/index',
    'pages/collections/manage',
    'pages/collections/detail',
    'pages/profile/index',
    'pages/projects/index',
    'pages/projects/detail',
    'pages/users/detail',
    'pages/about/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#F6F5EE',
    navigationBarTitleText: '拾光内容库',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F6F5EE',
  },
  style: 'v2',
});
