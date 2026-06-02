"use client";

import { ArrowRight, Play } from "lucide-react";
import { motion } from "motion/react";

export function Hero1() {
  return (
    <section className="w-full flex items-start lg:items-center py-12 px-4 sm:px-6 lg:px-8 bg-white dark:bg-neutral-950">
      <div className="max-w-[1400px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="flex flex-col space-y-6 sm:space-y-8">
            {/* Announcement Pill */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex items-center gap-2 sm:gap-3 rounded-full border-neutral-300 dark:border-neutral-800 border p-1 w-fit hover:border-neutral-600 dark:hover:border-neutral-500 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs sm:text-sm font-medium">
                New
              </span>
              <span className="text-sm sm:text-base text-neutral-900 dark:text-neutral-100 mr-2">
                AI-powered design systems
              </span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight font-medium text-neutral-900 dark:text-white leading-[1.15]"
            >
              Transform your product with intelligent design
            </motion.h1>

            {/* Sub-headline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-lg tracking-tight"
            >
              Get component libraries, design tokens, and expert tooling. Ship
              your design systems faster & smarter.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer px-6 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black font-medium text-sm sm:text-base hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors duration-200 w-full sm:w-auto"
              >
                Start Building
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer pl-5 pr-3 py-2.5 rounded-full border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium text-sm sm:text-base hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors duration-200 flex items-center justify-center gap-2 w-full sm:w-auto group"
              >
                Watch Demo
                <motion.span
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-black dark:bg-white"
                  whileHover={{ rotate: 90 }}
                  transition={{ duration: 0.3 }}
                >
                  <Play className="w-3 h-3 fill-white dark:fill-black" />
                </motion.span>
              </motion.button>
            </motion.div>

            {/* Social Proof */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex items-center gap-3 sm:gap-4 pt-2 sm:pt-4 select-none"
            >
              {/* User Avatars */}
              <div className="flex -space-x-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black dark:bg-white border-4 border-white dark:border-neutral-950 flex items-center justify-center text-white dark:text-black text-xs sm:text-sm font-semibold">
                  JD
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black dark:bg-white border-4 border-white dark:border-neutral-950 flex items-center justify-center text-white dark:text-black text-xs sm:text-sm font-semibold">
                  SK
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black dark:bg-white border-4 border-white dark:border-neutral-950 flex items-center justify-center text-white dark:text-black text-xs sm:text-sm font-semibold">
                  AL
                </div>
              </div>

              {/* Social Proof Text */}
              <div className="flex flex-col">
                <span className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-white">
                  50k+
                </span>
                <span className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                  Engineers shipping products daily.
                </span>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Visual Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative w-full h-auto"
          >
            <div className="relative w-full h-full min-h-[250px] sm:min-h-[500px] rounded-4xl bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1553877522-43269d4ea984?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Visual content placeholder"
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Decorative Circle */}
              <div className="absolute bottom-0 right-0 flex flex-col items-end">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 200 200"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0 200C155.996 199.961 200.029 156.308 200 0V200H0Z"
                    className="fill-white dark:fill-neutral-950"
                  />
                </svg>

                <div className="relative">
                  <div className="w-24 h-24 bg-white dark:bg-neutral-950 rounded-tl-4xl pl-4 pt-4">
                    <button className="w-full h-full cursor-pointer border-none flex items-center justify-center bg-black dark:bg-white border rounded-[1.2em] hover:opacity-90 transition-opacity">
                      <ArrowRight className="w-6 h-6 dark:text-neutral-950 text-white -rotate-45" />
                    </button>
                  </div>

                  {/* Bottom Left SVG */}
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 200 200"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute bottom-0 -left-10"
                  >
                    <path
                      d="M0 200C155.996 199.961 200.029 156.308 200 0V200H0Z"
                      className="fill-white dark:fill-neutral-950"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
