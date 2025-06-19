<script setup>
import day from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

day.extend(relativeTime);

const props = defineProps({
  gitSource: {
    type: Object,
    default: null
  },
  commitPosition: {
    type: Object,
    default: null
  },
  gitDeployment: {
    type: Object,
    default: null
  }
});

function formatDate(date, from) {
  return from ? day(date).fromNow() : day(date).format('DD MMM YYYY');
}
</script>

<template>
  <div class="repo-info">
    <div class="repo-info-owner">
      <img
        :src="props.gitSource.owner.avatarUrl"
        alt=""
      >
      <div>
        <a
          ref="nofollow"
          target="_blank"
          :href="props.gitSource.owner.htmlUrl"
        >{{ props.gitSource.owner.name }}</a>
        <span>/</span>
        <a
          ref="nofollow"
          target="_blank"
          :href="props.gitSource.htmlUrl"
        >{{ props.gitSource.name }}</a>
      </div>
    </div>
    <div
      v-if="props.gitDeployment.deployedCommit"
      class="repo-info-revision"
    >
      <span>
        <i class="icon icon-fw icon-commit" />
        {{ props.gitDeployment.deployedCommit.short }}

      </span>
      <span
        v-if="props.commitPosition"
        class="masthead-state badge-state"
      >
        <i class="icon icon-fw icon-commit" />
        {{ props.commitPosition.text }}
      </span>
    </div>
    <div
      v-if="props.gitSource.description"
      class="repo-info-description"
    >
      <i class="icon icon-fw icon-comment" />
      <p>
        {{ props.gitSource.description }}
      </p>
    </div>
    <ul>
      <li>
        <span>{{ t('epinio.applications.detail.deployment.details.git.created') }}</span>: {{ formatDate(props.gitSource.created_at) }}
      </li>
      <li>
        <span>{{ t('epinio.applications.detail.deployment.details.git.updated') }}</span>: {{ formatDate(props.gitSource.updated_at, true) }}
      </li>
    </ul>
  </div>
</template>

<style lang="scss" scoped>
  .application-card {
    margin-top: 0 !important;
  }

  .repo-info {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-gap: 20px;
    font-size: 14px;

    &-owner {
      display: flex;
      align-self: center;
      a {
        font-size: 16px !important;
      }

      img {
        margin-right: 8px;
        align-self: center;
        width: 20px;
        border-radius: 5%;
      }

      span {
        opacity: 0.5;
      }
    }

    &-description, &-revision{
      display: flex;
      align-items: center;
      align-self: center;
      i {
        opacity: 0.8;
      }

      span {
        display: flex;
        align-self: center;
      }
    }

    &-revision {
      justify-content: space-between;
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      justify-content: space-between;

      li {
        font-size: 14px;
        opacity: 0.5;
        span {
          color: var(--default-text);
        }
      }
    }
  }

</style>
