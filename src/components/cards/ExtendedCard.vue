<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4 overflow-hidden max-w-full">
    <!-- Header: actor profile + timestamp -->
    <div class="flex items-center justify-between mb-3">
      <slot name="header" />
    </div>
    <!-- Content area -->
    <div>
      <slot name="content" />
    </div>
  </div>
</template>
