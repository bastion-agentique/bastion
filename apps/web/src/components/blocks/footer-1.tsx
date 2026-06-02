"use client";

import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

export default function Footer1() {
  const footerCards = [
    {
      title: "Programs",
      links: [
        { text: "Personal Training", href: "#" },
        { text: "Nutrition Coaching", href: "#" },
        { text: "Group Classes", href: "#" },
        { text: "Online Membership", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { text: "About Us", href: "#" },
        { text: "Blog", href: "#" },
        { text: "Success Stories", href: "#", external: true },
      ],
    },
    {
      title: "Support",
      links: [
        { text: "Contact", href: "#" },
        { text: "Member Portal", href: "#", external: true },
        { text: "FAQ", href: "#" },
        { text: "Privacy Policy", href: "#" },
      ],
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <footer className="relative w-full overflow-hidden bg-white dark:bg-neutral-950 py-12 sm:py-16 md:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-6"
        >
          {/* Top Section - 4 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
            {/* First Column - Branding */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col justify-between space-y-6 mb-6 lg:mb-0"
            >
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black dark:bg-white">
                  <span className="text-lg font-bold text-white dark:text-black">
                    F
                  </span>
                </div>
                <span className="text-lg font-medium text-neutral-900 dark:text-white">
                  FITFORGE
                </span>
              </div>

              {/* Motto */}
              <div>
                <h3 className="text-lg font-medium tracking-tight text-neutral-900 dark:text-white sm:text-xl">
                  Transform your body,
                  <br />
                  elevate your life
                </h3>
              </div>

              {/* Small Text */}
              <div className="mt-auto">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Premium fitness coaching since 2019
                </p>
              </div>
            </motion.div>

            {/* Cards - Dynamically Rendered with negative margins approach */}
            {footerCards.map((card, index) => {
              let marginClass = "";

              if (index > 0) {
                marginClass = "-mt-px";
              }

              if (index === 0) {
                marginClass += " md:mt-0";
              } else if (index === 1) {
                marginClass += " md:-mt-px md:ml-0";
              } else if (index === 2) {
                marginClass += " md:-mt-px md:-ml-px";
              }

              marginClass += " lg:mt-0";
              if (index > 0) {
                marginClass += " lg:-ml-px";
              }

              return (
                <motion.div
                  key={card.title}
                  variants={itemVariants}
                  className={`group relative min-h-[300px] overflow-hidden border border-neutral-300 p-6 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900 sm:p-8 ${marginClass}`}
                >
                  <h4 className="mb-6 text-sm font-medium tracking-tight text-neutral-900 dark:text-white sm:text-base">
                    {card.title}
                  </h4>
                  <ul className="space-y-3">
                    {card.links.map((link) => (
                      <li key={link.text}>
                        <a
                          href={link.href}
                          className="inline-flex font-light items-center gap-1 text-sm text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white sm:text-base"
                        >
                          {link.text}
                          {link.external && (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom Section - Large Background Logo */}
          <motion.div
            variants={itemVariants}
            className="relative flex items-center justify-center overflow-hidden py-8 sm:py-12 md:py-16"
          >
            <div className="w-full px-4" aria-hidden="true">
              <svg
                viewBox="0 0 1805 285"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-auto"
              >
                <path
                  d="M-5.54791e-05 278.264V6.13193H198.924V66.3075H32.1958L75.1236 21.8466V146.414L32.1958 115.368H192.025V175.16H32.1958L75.1236 144.114V278.264H-5.54791e-05ZM220.194 278.264V6.13193H295.317V278.264H220.194ZM383.015 278.264V66.3075H303.675V6.13193H537.861V66.3075H458.522V278.264H383.015ZM549.788 278.264V6.13193H748.713V66.3075H581.984L624.912 21.8466V146.414L581.984 115.368H741.813V175.16H581.984L624.912 144.114V278.264H549.788ZM903.275 284.396C874.656 284.396 849.998 278.647 829.301 267.148C808.604 255.65 792.761 239.296 781.774 218.088C770.786 196.88 765.293 171.711 765.293 142.581C765.293 113.451 770.786 88.2825 781.774 67.0741C792.761 45.6102 808.604 29.129 829.301 17.6305C849.998 5.87642 874.656 -0.00060247 903.275 -0.00060247C932.149 -0.00060247 956.807 5.87642 977.249 17.6305C997.946 29.129 1013.79 45.6102 1024.78 67.0741C1035.76 88.2825 1041.26 113.451 1041.26 142.581C1041.26 171.711 1035.76 196.88 1024.78 218.088C1013.79 239.296 997.946 255.65 977.249 267.148C956.807 278.647 932.149 284.396 903.275 284.396ZM903.275 224.221C916.051 224.221 926.911 221.027 935.854 214.639C945.053 208.25 952.08 199.052 956.935 187.042C961.79 174.777 964.217 159.957 964.217 142.581C964.217 125.206 961.79 110.385 956.935 98.1201C952.08 85.855 945.053 76.5285 935.854 70.1404C926.911 63.4968 916.051 60.175 903.275 60.175C890.499 60.175 879.511 63.4968 870.312 70.1404C861.369 76.5285 854.47 85.855 849.615 98.1201C844.76 110.385 842.333 125.206 842.333 142.581C842.333 159.957 844.76 174.777 849.615 187.042C854.47 199.052 861.369 208.25 870.312 214.639C879.511 221.027 890.499 224.221 903.275 224.221ZM1062.04 278.264V6.13193H1191.97C1212.42 6.13193 1230.18 9.45373 1245.25 16.0973C1260.58 22.7409 1272.34 32.0675 1280.51 44.0771C1288.95 56.0866 1293.16 70.2682 1293.16 86.6216C1293.16 99.3977 1290.73 110.769 1285.88 120.734C1281.02 130.444 1274 138.493 1264.8 144.881C1255.6 151.269 1244.48 155.613 1231.45 157.912L1230.69 154.08C1249.85 154.08 1264.16 158.168 1273.61 166.345C1283.07 174.266 1288.31 186.02 1289.33 201.607L1295.46 278.264H1218.8L1214.97 214.639C1214.46 204.673 1211.78 197.391 1206.92 192.791C1202.07 187.936 1193.51 185.509 1181.24 185.509H1137.17V278.264H1062.04ZM1137.17 125.333H1178.18C1190.7 125.333 1200.15 122.778 1206.54 117.668C1213.18 112.302 1216.5 104.891 1216.5 95.4371C1216.5 85.7273 1213.18 78.4449 1206.54 73.5899C1200.15 68.735 1190.7 66.3075 1178.18 66.3075H1137.17V125.333ZM1438.51 284.396C1411.94 284.396 1389.07 278.519 1369.9 266.765C1350.74 254.756 1335.92 238.147 1325.44 216.938C1315.22 195.73 1310.11 170.944 1310.11 142.581C1310.11 115.24 1315.35 90.8377 1325.82 69.3738C1336.56 47.9099 1351.89 31.0454 1371.82 18.7803C1391.75 6.2597 1415.77 -0.00060247 1443.88 -0.00060247C1468.66 -0.00060247 1489.49 3.95999 1506.35 11.8812C1523.47 19.5469 1537.14 30.7899 1547.36 45.6102C1557.84 60.4305 1565.25 78.3171 1569.59 99.27L1491.79 102.336C1489.49 88.7935 1484.63 78.4449 1477.22 71.2902C1469.81 63.8801 1458.95 60.175 1444.64 60.175C1432.38 60.175 1421.9 63.6246 1413.21 70.5237C1404.78 77.4228 1398.27 87.0049 1393.67 99.27C1389.32 111.535 1387.15 125.972 1387.15 142.581C1387.15 158.935 1389.19 173.244 1393.28 185.509C1397.63 197.774 1404.14 207.356 1412.83 214.255C1421.52 220.899 1432.63 224.221 1446.18 224.221C1455.63 224.221 1463.68 222.687 1470.32 219.621C1477.22 216.299 1482.72 211.7 1486.8 205.823C1491.15 199.69 1493.96 192.408 1495.24 183.976H1444.26V134.149H1570.36V278.264H1526.67L1522.83 223.071L1531.27 224.604C1528.97 236.613 1523.47 247.09 1514.78 256.033C1506.35 264.976 1495.49 272.003 1482.2 277.114C1469.17 281.969 1454.61 284.396 1438.51 284.396ZM1599.75 278.264V6.13193H1801.35V66.3075H1674.87V111.918H1796.76V171.711H1674.87V218.088H1804.42V278.264H1599.75Z"
                  className="fill-neutral-200 dark:fill-neutral-900"
                />
              </svg>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </footer>
  );
}
