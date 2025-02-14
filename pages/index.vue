<template>
  <div class="w-full h-full">
    <div class="flex items-center justify-center pt-4 fixed bottom-4 left-0 right-0">
      <a href="https://github.com/Oasis256/StoryTeller" target="_blank" class="text-sm pr-2">{{ $strings.ForTheLove }}❤️{{ $strings.OfMariam }}.</a>
    </div>
  </div>
</template>

<script>
export default {
  asyncData({ redirect }) {
    return redirect('/bookshelf')
  },
  data() {
    return {}
  },
  computed: {},
  methods: {}
}
</script>
