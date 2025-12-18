/*
 Navicat Premium Dump SQL

 Source Server         : mysql
 Source Server Type    : MySQL
 Source Server Version : 80042 (8.0.42)
 Source Host           : nginx.naxi.fun:13306
 Source Schema         : listen-world

 Target Server Type    : MySQL
 Target Server Version : 80042 (8.0.42)
 File Encoding         : 65001

 Date: 18/12/2025 14:06:51
*/
-- ----------------------------
-- Table structure for tags
-- ----------------------------
DROP TABLE IF EXISTS `tags`;
CREATE TABLE `tags` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT, -- D1 中使用 INTEGER PRIMARY KEY 实现自增
  `name` varchar(255) DEFAULT NULL,
  `stationcount` int DEFAULT NULL
);
