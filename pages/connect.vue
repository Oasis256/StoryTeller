<template>
  <div class="w-full h-full">
    <div class="relative flex items-center justify-center min-h-screen sm:pt-0">
      <nuxt-link to="/" class="absolute top-2 left-2 z-20">
        <span class="material-symbols text-4xl">arrow_back</span>
      </nuxt-link>
      <div class="absolute top-0 left-0 w-full p-6 flex items-center flex-col justify-center z-0 short:hidden">
        <img src="/Logo.png" class="h-20 w-20 mb-2" />
        <h1 class="text-2xl">AudbleTales</h1>
      </div>
      <p class="hidden absolute short:block top-1.5 left-12 p-2 text-xl">AudbleTales</p>

      <connection-server-connect-form v-if="deviceData" />
    </div>

    <div class="flex items-center justify-center pt-4 fixed bottom-4 left-0 right-0">
      <a href="https://github.com/Oasis256/StoryTeller" target="_blank" class="text-sm pr-2">{{ $strings.ForTheLove }}❤️{{ $strings.OfMariam }}.</a>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'blank',
  data() {
    return {
      deviceData: null
    }
  },
  computed: {},
  methods: {
    async init() {
      this.deviceData = await this.$db.getDeviceData()
      this.$store.commit('setDeviceData', this.deviceData)
      await this.$store.dispatch('setupNetworkListener')
    }
  },
  mounted() {
    // Reset data on logouts
    this.$store.commit('libraries/reset')
    this.$store.commit('setIsFirstLoad', true)
    this.init()
  }
}
</script>
