<script>
import ResourceTable from '@shell/components/ResourceTable';
import { EPINIO_TYPES } from '../types';
import Loading from '@shell/components/Loading';

export default {
  name:       'EpinioGitConfigsList',
  components: {
    Loading,
    ResourceTable,
  },
  fetch() {
    this.$store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.GIT_CONFIG });
  },
  props: {
    schema: {
      type:     Object,
      required: true,
    },
  },

  computed: {
    rows() {
      return this.$store.getters['epinio/all'](EPINIO_TYPES.GIT_CONFIG);
    },
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else>
    <ResourceTable
      v-bind="$attrs"
      :rows="rows"
      :schema="schema"
    />
  </div>
</template>
