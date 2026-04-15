#!/usr/bin/env ruby
require 'xcodeproj'

project_path = File.join(__dir__, '..', 'ios', 'Runner.xcodeproj')
project = Xcodeproj::Project.open(project_path)

# Check if extension target already exists
if project.targets.any? { |t| t.name == 'SwiftSafariExtension' }
  puts "SwiftSafariExtension target already exists, skipping."
  exit 0
end

puts "Adding SwiftSafariExtension target..."

# Get the main app target
app_target = project.targets.find { |t| t.name == 'Runner' }
raise "Runner target not found" unless app_target

# Create the extension target
ext_target = project.new_target(
  :app_extension,
  'SwiftSafariExtension',
  :ios,
  '16.0'
)

# Set bundle identifier
ext_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.swift.swiftSafariGesture.extension'
  config.build_settings['INFOPLIST_FILE'] = 'SwiftSafariExtension/Info.plist'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  config.build_settings['DEVELOPMENT_TEAM'] = app_target.build_configurations.first.build_settings['DEVELOPMENT_TEAM'] || ''
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  config.build_settings['CURRENT_PROJECT_VERSION'] = '1'
  config.build_settings['MARKETING_VERSION'] = '1.0.0'
  config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
  config.build_settings['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
  # Remove any default LD flags that might conflict
  config.build_settings.delete('OTHER_LDFLAGS')
end

# Add source files to extension target
ext_group = project.main_group.new_group('SwiftSafariExtension', 'SwiftSafariExtension')

# SafariWebExtensionHandler.swift
handler_ref = ext_group.new_file('SafariWebExtensionHandler.swift')
ext_target.source_build_phase.add_file_reference(handler_ref)

# AppGroupConstants.swift (shared) - add to extension target too
shared_group = project.main_group.groups.find { |g| g.name == 'Shared' }
if shared_group
  shared_group.files.each do |file|
    ext_target.source_build_phase.add_file_reference(file)
  end
end

# Add resources
resources_group = ext_group.new_group('Resources', 'Resources')

# manifest.json
manifest_ref = resources_group.new_file('manifest.json')
ext_target.resources_build_phase.add_file_reference(manifest_ref)

# Content directory
content_group = resources_group.new_group('content', 'content')
content_js = content_group.new_file('content_script.js')
content_css = content_group.new_file('content_style.css')
ext_target.resources_build_phase.add_file_reference(content_js)
ext_target.resources_build_phase.add_file_reference(content_css)

# Background directory
bg_group = resources_group.new_group('background', 'background')
bg_js = bg_group.new_file('background.js')
ext_target.resources_build_phase.add_file_reference(bg_js)

# Popup directory
popup_group = resources_group.new_group('popup', 'popup')
popup_html = popup_group.new_file('popup.html')
ext_target.resources_build_phase.add_file_reference(popup_html)

# Locales
locales_group = resources_group.new_group('_locales', '_locales')
['en', 'ko', 'ja', 'zh_CN', 'fr', 'hi'].each do |lang|
  lang_group = locales_group.new_group(lang, lang)
  msg_ref = lang_group.new_file('messages.json')
  ext_target.resources_build_phase.add_file_reference(msg_ref)
end

# Info.plist (already set via build settings, don't add to resources)

# Embed the extension in the main app
embed_phase = app_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.dst_subfolder_spec = '13' # PlugIns folder
embed_phase.dst_path = ''

build_file = embed_phase.add_file_reference(ext_target.product_reference)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# Add target dependency
app_target.add_dependency(ext_target)

# Save
project.save
puts "SwiftSafariExtension target added successfully!"
puts "Extension bundle ID: com.swift.swiftSafariGesture.extension"
