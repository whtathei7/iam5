#!/bin/sh
set -eu

PORT=$(uci -q get openclash.config.cn_port || true)
[ -n "$PORT" ] || PORT=9090
PASSWORD=$(uci -q get openclash.config.dashboard_password || true)

ruby -rjson -rnet/http -ruri -e '
port = ARGV[0]
token = ARGV[1].to_s
base = URI("http://127.0.0.1:#{port}")

def request_json(base, token, path)
  uri = base + path
  request = Net::HTTP::Get.new(uri)
  request["Authorization"] = "Bearer #{token}" unless token.empty?
  response = Net::HTTP.start(uri.host, uri.port, open_timeout: 3, read_timeout: 20) { |http| http.request(request) }
  raise "HTTP #{response.code}: #{response.body}" unless response.is_a?(Net::HTTPSuccess)
  JSON.parse(response.body)
end

all = request_json(base, token, "/proxies").fetch("proxies")
group_name = ["🧠 Codex智能", "🤖 OpenAI", "🚀 节点选择"].find { |name| all.key?(name) }
abort "找不到 Codex 策略组" unless group_name
group = all.fetch(group_name)
members = Array(group["all"]).select { |name| all[name].is_a?(Hash) && Array(all[name]["all"]).empty? }
members = Array(group["all"]) if members.empty?
abort "#{group_name} 没有节点" if members.empty?

target = "https://chatgpt.com/cdn-cgi/trace"
results = members.map do |name|
  escaped_name = URI::DEFAULT_PARSER.escape(name, /[^A-Za-z0-9\-._~]/)
  path = "/proxies/#{escaped_name}/delay?timeout=12000&url=#{URI.encode_www_form_component(target)}"
  begin
    data = request_json(base, token, path)
    [name, data["delay"].to_i, nil]
  rescue => error
    [name, nil, error.message]
  end
end

ok = results.select { |_, delay, _| delay && delay > 0 }.sort_by { |_, delay, _| delay }
failed = results.reject { |_, delay, _| delay && delay > 0 }
puts "group=#{group_name} selected=#{group["now"]} tested=#{results.length} ok=#{ok.length} failed=#{failed.length}"
ok.first(20).each_with_index { |(name, delay, _), index| puts "%2d. %5d ms  %s" % [index + 1, delay, name] }
failed.first(10).each { |name, _, error| warn "FAIL #{name}: #{error}" }
exit(ok.empty? ? 1 : 0)
' "$PORT" "$PASSWORD"
