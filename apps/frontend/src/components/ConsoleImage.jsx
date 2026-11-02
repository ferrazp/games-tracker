export default function ConsoleImage({ console: c, className }) {
  if (!c?.image) return null;

  if (c.image_type === 'svg') {
    return <span className={className} dangerouslySetInnerHTML={{ __html: c.image }} />;
  }

  return <img src={c.image} alt="" className={className} />;
}
