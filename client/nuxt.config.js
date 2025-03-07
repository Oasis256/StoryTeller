const pkg = require('./package.json')
const routerBasePath = process.env.ROUTER_BASE_PATH ?? '' //'/shelf'
const serverHostUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3333'
const serverPaths = ['api/', 'public/', 'hls/', 'auth/', 'feed/', 'status', 'login', 'logout', 'init']
const proxy = Object.fromEntries(serverPaths.map((path) => [`${routerBasePath}/${path}`, { target: process.env.NODE_ENV !== 'production' ? serverHostUrl : '/' }]))
module.exports = {
  // Disable server-side rendering: https://go.nuxtjs.dev/ssr-mode
  ssr: false,
  target: 'static',
  dev: process.env.NODE_ENV !== 'production',
  env: {
    serverUrl: serverHostUrl + routerBasePath,
    chromecastReceiver: 'FD1F76C5'
  },
  telemetry: false,
  publicRuntimeConfig: {
    version: pkg.version,
    routerBasePath
  },
  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: 'The AudbleTales',
    htmlAttrs: {
      lang: 'en'
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '' },
      { property: 'fb:app_id', content: '1607117262915201' },
      { name: 'description', content: 'The AudbleTales' },
      { name: 'author', content: 'Oasis Innocent❤️oasis.sybill@shu-le.me❤️' },
      { name: 'web_author', content: 'The N-line Project codeStudio' },
      { NAME: 'Copyright', CONTENT: 'The N-line Project' },
      { NAME: 'Designer', CONTENT: 'Oasis Innocent' },
      { NAME: 'Publisher', CONTENT: 'Oasis Innocent, codeStudio, The N-line Project' },
      { NAME: 'distribution', CONTENT: 'Global' },
      { name: 'contact', content: 'oasis.sybill@gmail.com' },
      { name: 'robots', content: 'index, follow' },
      { name: 'revisit-after', content: '3 month' },
      // { NAME: 'ROBOTS', CONTENT: 'NOYDIR,NOODP' },
      { name: 'Subject', content: 'Online Education For All' },
      { NAME: 'city', CONTENT: 'Kampala' },
      { NAME: 'country', CONTENT: 'Uganda' },
      { NAME: 'Geography', CONTENT: 'Kansanga, Kampala, Uganda' },
      { hid: 'robots', name: 'robots', content: 'noindex' }
    ],
    // metaInfo: {
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'http://schema.org',
          '@type': 'Organization',
          '@id': 'reads.shu-le.me',
          name: 'Self Hosted AudioBook Server and Reader',
          logo: (process.env.ROUTER_BASE_PATH || '') + '/Logo.png',
          telephone: '+256 750 994 545',
          email: 'support@shu-le.me',
          sameAs: ['https://reads.shu-le.me', 'http://www.reads.shu-le.me', 'http://reads.shu-le.me'],
          url: 'https://reads.shu-le.me',
          image: (process.env.ROUTER_BASE_PATH || '') + '/Logo.png',
          description: "Shule, You don't need to go to school, School will come to you.",
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Kansanga',
            addressLocality: 'Kampala',
            addressCountry: 'Uganda',
            addressRegion: 'East Africa',
            postalCode: '256',
            name: 'codeStudio'
          }
        })
      },
      {
        src: 'https://mon.shu-le.tech/tracker.js',
        async: true,
        defer: true,
        'data-website-id': 'cm5s4a32g0005xzin0631qo7n',
        id: 'nlpTianji',
        class: 'nlpScript'
      }
    ],
    // },
    link: [
      { rel: 'icon', type: 'image/x-icon', href: routerBasePath + '/favicon.ico' },
      { rel: 'apple-touch-icon', href: routerBasePath + '/ios_icon.png' }
    ]
  },
  router: {
    base: routerBasePath
  },
  // Global CSS: https://go.nuxtjs.dev/config-css
  css: ['@/assets/tailwind.css', '@/assets/app.css'],
  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: ['@/plugins/constants.js', '@/plugins/init.client.js', '@/plugins/axios.js', '@/plugins/toast.js', '@/plugins/utils.js', '@/plugins/i18n.js'],
  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,
  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/tailwindcss
    '@nuxtjs/pwa'
  ],
  // Modules: https://go.nuxtjs.dev/config-modules
  modules: ['nuxt-socket-io', '@nuxtjs/axios', '@nuxtjs/proxy'],
  proxy,
  io: {
    sockets: [
      {
        name: 'dev',
        url: serverHostUrl
      },
      {
        name: 'prod'
      }
    ]
  },
  // Axios module configuration: https://go.nuxtjs.dev/config-axios
  axios: {
    baseURL: routerBasePath
  },
  // nuxt/pwa https://pwa.nuxtjs.org
  pwa: {
    icon: false,
    meta: {
      appleStatusBarStyle: 'black',
      name: 'The AudbleTales',
      theme_color: '#232323',
      mobileAppIOS: true,
      nativeUI: true
    },
    manifest: {
      name: 'The AudbleTales',
      short_name: 'The AudbleTales',
      display: 'standalone',
      background_color: '#232323',
      icons: [
        {
          src: routerBasePath + '/icon.svg',
          sizes: 'any'
        },
        {
          src: routerBasePath + '/icon192.png',
          type: 'image/png',
          sizes: 'any'
        }
      ]
    },
    workbox: {
      offline: false,
      cacheAssets: false,
      preCaching: [],
      runtimeCaching: []
    }
  },
  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {
    postcss: {
      postcssOptions: {
        plugins: {
          tailwindcss: {},
          autoprefixer: {}
        }
      }
    }
  },
  watchers: {
    webpack: {
      aggregateTimeout: 300,
      poll: 1000
    }
  },
  server: {
    port: process.env.NODE_ENV === 'production' ? 80 : 3000,
    host: '0.0.0.0'
  },
  /**
   * Temporary workaround for @nuxt-community/tailwindcss-module.
   *
   * Reported: 2022-05-23
   * See: [Issue tracker](https://github.com/nuxt-community/tailwindcss-module/issues/480)
   */
  devServerHandlers: [],
  ignore: ['**/*.test.*', '**/*.cy.*']
}
