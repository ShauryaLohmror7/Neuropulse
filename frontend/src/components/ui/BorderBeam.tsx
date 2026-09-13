/** CSS implementation of the border-beam pattern browsed on 21st.dev / Magic UI.
 * Decorative, pointer-transparent and disabled by reduced-motion preferences.
 */
export function BorderBeam({className=''}:{className?:string}) {
  return <span className={`border-beam ${className}`} aria-hidden="true"><i/></span>
}
