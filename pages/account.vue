<template>
  <div class="w-full h-full p-4">
    <ui-text-input-with-label :value="serverAddress" :label="$strings.LabelHost" disabled class="my-2" />

    <ui-text-input-with-label :value="username" :label="$strings.LabelUsername" disabled class="my-2" />

    <ui-btn color="primary flex items-center justify-between gap-2 ml-auto text-base mt-8" @click="logout">{{ $strings.ButtonSwitchServerUser }}<span class="material-symbols" style="font-size: 1.1rem">logout</span></ui-btn>

    <div class="flex justify-center items-center my-4 left-0 right-0 bottom-0 absolute">
      <p class="text-sm text-fg">{{ $strings.ForTheLove }}❤️{{ $strings.OfMariam }}.</p>
    </div>
  </div>
</template>

<script>
export default {
  asyncData({ redirect, store }) {
    if (!store.state.socketConnected) {
      return redirect('/connect')
    }
    return {}
  },
  data() {
    return {}
  },
  computed: {
    username() {
      if (!this.user) return ''
      return this.user.username
    },
    user() {
      return this.$store.state.user.user
    },
    serverConnectionConfig() {
      return this.$store.state.user.serverConnectionConfig || {}
    },
    serverAddress() {
      return this.serverConnectionConfig.address
    }
  },
  methods: {
    async logout() {
      await this.$hapticsImpact()
      if (this.user) {
        await this.$nativeHttp.post('/logout').catch((error) => {
          console.error(error)
        })
      }

      this.$socket.logout()
      await this.$db.logout()
      this.$localStore.removeLastLibraryId()
      this.$store.commit('user/logout')
      this.$store.commit('libraries/setCurrentLibrary', null)
      this.$router.push('/connect')
    }
  },
  mounted() {}
}
</script>
