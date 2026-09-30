// 构建时配置。API_BASE_URL 是服务根地址，不包含 /api。
class AppConfig {
  const AppConfig._();

  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const mapTilerKey = String.fromEnvironment('MAPTILER_API_KEY');

  // 验证服务地址，避免把空值或错误 scheme 带入网络层。
  static Uri? get apiOrigin {
    final value = apiBaseUrl.trim();
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !uri.hasAuthority ||
        (uri.scheme != 'http' && uri.scheme != 'https') ||
        uri.userInfo.isNotEmpty ||
        uri.query.isNotEmpty ||
        uri.fragment.isNotEmpty) {
      return null;
    }
    return uri.replace(path: uri.path.replaceAll(RegExp(r'/$'), ''));
  }
}
