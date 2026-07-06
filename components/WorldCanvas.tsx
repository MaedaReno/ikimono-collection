"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Image as KonvaImage, Text } from "react-konva";
import type Konva from "konva";

export type PlacedItem = {
  id: string; // placement id
  captureId: string;
  url: string;
  name: string;
  x: number;
  y: number;
  scale: number;
};

function useLoadedImage(url: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    image.onload = () => setImg(image);
    return () => {
      image.onload = null;
    };
  }, [url]);
  return img;
}

function CreatureNode({
  item,
  onDragEnd,
  onSelect,
  selected,
}: {
  item: PlacedItem;
  onDragEnd: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
  selected: boolean;
}) {
  const img = useLoadedImage(item.url);
  const size = 96 * item.scale;
  if (!img) return null;
  return (
    <KonvaImage
      image={img}
      x={item.x}
      y={item.y}
      width={size}
      height={size}
      draggable
      shadowColor={selected ? "#059669" : undefined}
      shadowBlur={selected ? 12 : 0}
      onClick={() => onSelect(item.id)}
      onTap={() => onSelect(item.id)}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) =>
        onDragEnd(item.id, e.target.x(), e.target.y())
      }
    />
  );
}

export default function WorldCanvas({
  items,
  onMove,
  selectedId,
  onSelect,
}: {
  items: PlacedItem[];
  onMove: (id: string, x: number, y: number) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const height = 520;

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <Stage
        width={width}
        height={height}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) onSelect(null);
        }}
        className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <Layer>
          {/* 背景：草原と空 */}
          <Rect x={0} y={0} width={width} height={height} fill="#bae6fd" />
          <Rect x={0} y={height * 0.6} width={width} height={height * 0.4} fill="#86efac" />
          {items.length === 0 && (
            <Text
              text="下のコレクションから生き物を追加してみよう"
              x={0}
              y={height / 2 - 10}
              width={width}
              align="center"
              fontSize={16}
              fill="#334155"
            />
          )}
        </Layer>
        <Layer>
          {items.map((item) => (
            <CreatureNode
              key={item.id}
              item={item}
              onDragEnd={onMove}
              onSelect={onSelect}
              selected={selectedId === item.id}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
