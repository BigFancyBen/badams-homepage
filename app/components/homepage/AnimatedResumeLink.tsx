"use client";

import Link from "next/link";
import { motion } from "motion/react";

export function AnimatedResumeLink() {
  return (
    <motion.div
      className="fixed top-4 right-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.75, duration: 0.5 }}
    >
      <Link
        href="/resume"
        className="text-sm text-gray-400 hover:text-white transition-colors"
      >
        Resume
      </Link>
    </motion.div>
  );
}
