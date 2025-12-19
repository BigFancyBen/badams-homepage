"use client";

import { useState, useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";

// All available images
const ALL_IMAGES = [
  "27OZ12Lq_o.jpg",
  "2LUtgtDT_o.jpg",
  "6TnULgSA_o.jpg",
  "AFfaeVY2_o.jpg",
  "BRW5rDXu_o.jpg",
  "CS07SdMw_o.jpg",
  "CxyL2KQP_o.jpg",
  "eUmtSjEW_o.jpg",
  "FAODWl3V_o.jpg",
  "gBZSYSi1_o.jpg",
  "gHsBereL_o.jpg",
  "GuB9V9so_o.jpg",
  "HDJx7LQn_o.jpg",
  "HEnzJcox_o.jpg",
  "hfqHwtoe_o.jpg",
  "IevT1kNW_o.jpg",
  "iVFvMGcJ_o.jpg",
  "k7ynvMqo_o.jpg",
  "kzBqJpW4_o.jpg",
  "l1knf9QN_o.jpg",
  "oiDgvThT_o.jpg",
  "ophUNJc4_o.jpg",
  "PTL4lnGR_o.jpg",
  "r3BG6G3S_o.jpg",
  "Ra4763cD_o.jpg",
  "rc7uLXxA_o.jpg",
  "sEWLxYMo_o.jpg",
  "SkOTPp7t_o.jpg",
  "tflRpduE_o.jpg",
  "TQOIY0FT_o.jpg",
  "v5HEBLKa_o.jpg",
  "vTNQ7ytb_o.jpg",
  "VYnRKN04_o.jpg",
  "wnpFmXpp_o.jpg",
  "XBYYphoW_o.jpg",
  "xfLKw6WF_o.jpg",
  "XHIdnUxO_o.jpg",
  "yZ7Z4yfv_o.jpg",
  "ZW43RXvU_o.jpg",
];

// Function to shuffle and select 30 random images
function selectRandomImages(): string[] {
  const shuffled = [...ALL_IMAGES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 30);
}

export default function TomsIdioTest() {
  // Use lazy initialization for selectedButtons from localStorage
  const [selectedButtons, setSelectedButtons] = useState<Set<number>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("idiotest-selected");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return new Set(parsed);
        } catch (error) {
          console.error("Failed to load selected buttons:", error);
        }
      }
    }
    return new Set();
  });

  const [currentView, setCurrentView] = useState<"grid" | number>("grid");

  // Use lazy initialization for currentImages from localStorage
  const [currentImages, setCurrentImages] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const savedImages = localStorage.getItem("idiotest-images");
      if (savedImages) {
        try {
          const parsed = JSON.parse(savedImages);
          return parsed;
        } catch (error) {
          console.error("Failed to load images:", error);
        }
      }
    }
    return selectRandomImages();
  });

  // Track if client-side to enable saving
  const hasLoaded = useRef(false);
  useEffect(() => {
    hasLoaded.current = true;
  }, []);

  // Save selected buttons to localStorage whenever they change
  useEffect(() => {
    if (hasLoaded.current && typeof window !== "undefined") {
      localStorage.setItem(
        "idiotest-selected",
        JSON.stringify(Array.from(selectedButtons))
      );
    }
  }, [selectedButtons]);

  // Save current images to localStorage whenever they change
  useEffect(() => {
    if (
      hasLoaded.current &&
      typeof window !== "undefined" &&
      currentImages.length > 0
    ) {
      localStorage.setItem("idiotest-images", JSON.stringify(currentImages));
    }
  }, [currentImages]);

  const handleButtonClick = (num: number) => {
    setSelectedButtons((prev) => new Set([...prev, num]));
    setCurrentView(num);
  };

  const handleReset = () => {
    setSelectedButtons(new Set());
    setCurrentImages(selectRandomImages());
    if (typeof window !== "undefined") {
      localStorage.removeItem("idiotest-selected");
    }
  };

  const handleBackToGrid = () => {
    setCurrentView("grid");
  };

  if (currentView !== "grid") {
    const imagePath = currentImages[currentView - 1] || currentImages[0];
    return (
      <ImageView
        imageNumber={currentView}
        onBack={handleBackToGrid}
        imagePath={imagePath}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col">
      {/* Reset button in top left */}
      <button
        onClick={handleReset}
        className="fixed top-4 left-4 md:top-8 md:left-8 p-3 md:p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors z-10"
        aria-label="Reset all buttons"
      >
        <RotateCcw className="w-8 h-8 md:w-12 md:h-12" />
      </button>

      {/* Title */}
      <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-center mb-4 md:mb-8 mt-16 md:mt-0">
        Idiotest
      </h1>

      {/* Grid of 30 buttons - responsive sizing for different screen sizes */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div
          className="w-full max-w-[1600px]"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gridTemplateRows: "repeat(6, 1fr)",
            gap: "clamp(8px, 1vw, 24px)",
            aspectRatio: "5 / 6",
            maxHeight: "calc(100vh - 250px)",
          }}
        >
          {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => {
            const isSelected = selectedButtons.has(num);
            return (
              <button
                key={num}
                onClick={() => handleButtonClick(num)}
                className={`
                  rounded-lg font-bold
                  transition-all duration-200
                  flex items-center justify-center
                  ${
                    isSelected
                      ? "bg-gray-700 text-gray-500 border-2 md:border-4 border-gray-600"
                      : "bg-blue-600 hover:bg-blue-500 text-white border-2 md:border-4 border-blue-400"
                  }
                `}
                style={{
                  fontSize: "clamp(2rem, 4vw, 6rem)",
                }}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ImageViewProps {
  imageNumber: number;
  onBack: () => void;
  imagePath: string;
}

function ImageView({ imageNumber, onBack, imagePath }: ImageViewProps) {
  const [timeLeft, setTimeLeft] = useState(25);
  const audioPlayedRef = useRef(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    // Only start the timer once the image has loaded
    if (!imageLoaded) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [imageLoaded]);

  useEffect(() => {
    // Play audio when timer reaches 0
    if (timeLeft === 0 && !audioPlayedRef.current) {
      audioPlayedRef.current = true;
      const audio = new Audio("/times-up.mp3");
      audio.play().catch((error) => {
        console.error("Failed to play audio:", error);
      });
    }
  }, [timeLeft]);

  return (
    <div
      className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8"
      onClick={timeLeft === 0 ? onBack : undefined}
      style={{ cursor: timeLeft === 0 ? "pointer" : "default" }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="fixed top-8 left-8 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors z-10"
        aria-label="Go back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
      </button>

      {/* Timer */}
      <div className="text-9xl font-bold mb-8 text-red-500">{timeLeft}</div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center w-full max-w-full">
        <img
          src={`/idiotest-images/${imagePath}`}
          alt={`Image ${imageNumber}`}
          className="w-full h-full object-contain"
          style={{
            maxWidth: "100vw",
            maxHeight: "calc(100vh - 250px)",
          }}
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            // Fallback if image doesn't exist
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent) {
              const fallback = document.createElement("div");
              fallback.className = "text-6xl text-gray-500";
              fallback.textContent = `Image ${imageNumber} not found`;
              parent.appendChild(fallback);
            }
          }}
        />
      </div>
    </div>
  );
}
