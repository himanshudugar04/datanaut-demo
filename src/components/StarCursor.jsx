import { useEffect, useRef, useState } from "react";

const MAX_STARS = 18;
const STAR_LIFETIME = 650;

function StarCursor() {
  const [stars, setStars] = useState([]);
  const counterRef = useRef(0);
  const timeoutsRef = useRef([]);

  useEffect(() => {
    const handleMove = (event) => {
      const id = counterRef.current++;
      const star = {
        id,
        x: event.clientX,
        y: event.clientY,
        size: 6 + Math.random() * 8,
        hue: 200 + Math.random() * 120
      };
      setStars((prev) => {
        const next = [...prev, star];
        if (next.length > MAX_STARS) {
          next.shift();
        }
        return next;
      });

      const timeoutId = setTimeout(() => {
        setStars((prev) => prev.filter((item) => item.id !== id));
      }, STAR_LIFETIME);
      timeoutsRef.current.push(timeoutId);
    };

    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="star-cursor-layer" aria-hidden="true">
      {stars.map((star) => (
        <span
          key={star.id}
          className="star-cursor"
          style={{
            left: `${star.x}px`,
            top: `${star.y}px`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            background: `radial-gradient(circle, rgba(255,255,255,0.95), hsla(${star.hue}, 90%, 70%, 0.2))`
          }}
        />
      ))}
    </div>
  );
}

export default StarCursor;
