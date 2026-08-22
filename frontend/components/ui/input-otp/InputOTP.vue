<script setup>
import { reactiveOmit } from "@vueuse/core";
import { useForwardPropsEmits } from "reka-ui";
import { OTPInput } from "vue-input-otp";
import { cn } from "@/lib/utils";

const props = defineProps({
  maxlength: { type: Number, required: true },
  textAlign: { type: String, required: false },
  inputmode: { type: String, required: false },
  containerClass: { type: String, required: false },
  pushPasswordManagerStrategy: { type: String, required: false },
  noScriptCssFallback: { type: [String, null], required: false },
  defaultValue: { type: null, required: false },
  pasteTransformer: { type: Function, required: false },
  nonce: { type: String, required: false },
  accept: { type: String, required: false },
  alt: { type: String, required: false },
  autocomplete: { type: String, required: false },
  autofocus: { type: Boolean, required: false },
  capture: { type: [Boolean, String], required: false },
  checked: { type: [Boolean, Array, Set], required: false },
  crossorigin: { type: String, required: false },
  disabled: { type: Boolean, required: false },
  enterKeyHint: { type: String, required: false },
  form: { type: String, required: false },
  formaction: { type: String, required: false },
  formenctype: { type: String, required: false },
  formmethod: { type: String, required: false },
  formnovalidate: { type: Boolean, required: false },
  formtarget: { type: String, required: false },
  height: { type: Number, required: false },
  indeterminate: { type: Boolean, required: false },
  list: { type: String, required: false },
  max: { type: Number, required: false },
  min: { type: Number, required: false },
  minlength: { type: Number, required: false },
  multiple: { type: Boolean, required: false },
  name: { type: String, required: false },
  pattern: { type: String, required: false },
  placeholder: { type: String, required: false },
  readonly: { type: Boolean, required: false },
  required: { type: Boolean, required: false },
  size: { type: Number, required: false },
  spellcheck: { type: Boolean, required: false },
  src: { type: String, required: false },
  step: { type: Number, required: false },
  type: { type: String, required: false },
  value: { type: null, required: false },
  width: { type: Number, required: false },
  class: { type: null, required: false },
});

const emits = defineEmits([
  "complete",
  "change",
  "select",
  "input",
  "focus",
  "blur",
  "mouseover",
  "mouseleave",
  "paste",
]);

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <OTPInput
    v-slot="slotProps"
    v-bind="forwarded"
    :container-class="
      cn('flex items-center gap-2 has-disabled:opacity-50', props.class)
    "
    data-slot="input-otp"
    class="disabled:cursor-not-allowed"
  >
    <slot v-bind="slotProps" />
  </OTPInput>
</template>
