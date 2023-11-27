import Vue from 'vue';
import { getProductName } from '../utils/utils';

export default Vue.extend({
  computed: {
    productName() {
      return getProductName(this.t.bind(this));
    }
  }
});
