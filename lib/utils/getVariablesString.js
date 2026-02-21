import _ from 'lodash'
/**
 * Generates a LESS variables string from a nested data object
 * @param {Object} data The data to process
 * @param {String} variablesStr String memo to allow recursion
 * @return {String} The processed LESS variables string
 * @memberof coursetheme
 */
export function getVariablesString (data = {}, variablesStr = '') {
  return Object.entries(data).reduce((s, [k, v]) => {
    if (_.isObject(v)) return getVariablesString(v, s)
    return v ? `${s}@${k}: ${v};\n` : s
  }, variablesStr)
}
