const pkg = require('./package.json')

module.exports = {
  // Disable server-side rendering: https://go.nuxtjs.dev/ssr-mode
  ssr: false,
  target: 'static',
  dev: process.env.NODE_ENV !== 'production',
  env: {
    serverUrl: process.env.NODE_ENV === 'production' ? process.env.ROUTER_BASE_PATH || '' : 'http://localhost:3333',
    chromecastReceiver: 'FD1F76C5'
  },
  telemetry: false,

  publicRuntimeConfig: {
    version: pkg.version,
    routerBasePath: process.env.ROUTER_BASE_PATH || ''
  },

  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: 'The Book Shelf',
    htmlAttrs: {
      lang: 'en'
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '' },
      { property: 'fb:app_id', content: '1607117262915201' },
      { name: 'description', content: 'The Book Shelf' },
      { name: 'author', content: 'Oasis Innocent &hearts; oasis.sybill@shule.life &hearts;' },
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
      { NAME: 'Geography', CONTENT: 'Kansanga, Kampala, Uganda' }
    ],
    script: [],
  // metaInfo: {
    script: [
      {
        type: 'application/ld+json',
        json: {
          "@context": "http://schema.org",
          "@type": "Organization",
          "@id": "reads.shule.life",
          "name": "Self Hosted AudioBook Server and Reader",
          "logo": (process.env.ROUTER_BASE_PATH || '') + '/Logo.png',
          "telephone": "+256 750 994 545",
          "email": "support@shule.life",
          "sameAs": [
            "https://reads.shule.life",
            "http://www.reads.shule.life",
            "http://reads.shule.life",
          ],
          "url": "https://reads.shule.life",
          "image": (process.env.ROUTER_BASE_PATH || '') + '/Logo.png',
          "description": "Shule, You don't need to go to school, School will come to you.",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Kansanga",
            "addressLocality": "Kampala",
            "addressCountry": "Uganda",
            "addressRegion": "East Africa",
            "postalCode": "256",
            name: 'codeStudio',
            id: 'nlpVone',
            class: 'nlpScript'
          }
        }
      }
    ],
  // },
    link: [
      { rel: 'icon', type: 'image/x-icon', href: (process.env.ROUTER_BASE_PATH || '') + '/favicon.ico' }
    ]
  },

  router: {
    base: process.env.ROUTER_BASE_PATH || ''
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [
    '@/assets/app.css'
  ],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
    '@/plugins/constants.js',
    '@/plugins/init.client.js',
    '@/plugins/axios.js',
    '@/plugins/toast.js',
    '@/plugins/utils.js',
    '@/plugins/i18n.js'
  ],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/tailwindcss
    '@nuxtjs/tailwindcss',
    '@nuxtjs/pwa',
    '@nuxt/postcss8'
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    'nuxt-socket-io',
    '@nuxtjs/axios',
    '@nuxtjs/proxy'
  ],

  proxy: {
    '/api/': { target: process.env.NODE_ENV !== 'production' ? 'http://localhost:3333' : '/' },
    '/dev/': { target: 'http://localhost:3333', pathRewrite: { '^/dev/': '' } }
  },

  io: {
    sockets: [{
      name: 'dev',
      url: 'http://localhost:3333'
    },
    {
      name: 'prod'
    }]
  },

  // Axios module configuration: https://go.nuxtjs.dev/config-axios
  axios: {
    baseURL: process.env.ROUTER_BASE_PATH || ''
  },

  // nuxt/pwa https://pwa.nuxtjs.org
  pwa: {
    icon: false,
    meta: {
      appleStatusBarStyle: 'black',
      name: 'The Book Shelf',
      theme_color: '#373838',
      mobileAppIOS: true,
      nativeUI: true
    },
    manifest: {
      name: 'The Book Shelf',
      short_name: 'The Book Shelf',
      display: 'standalone',
      background_color: '#373838',
      icons: [
        {
          src: (process.env.ROUTER_BASE_PATH || '') + '/icon.svg',
          sizes: "any"
        },
        {
          src: (process.env.ROUTER_BASE_PATH || '') + '/icon64.png',
          type: "image/png",
          sizes: "64x64"
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
      plugins: {
        tailwindcss: {},
        autoprefixer: {},
      },
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
}
