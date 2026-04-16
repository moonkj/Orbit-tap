#!/usr/bin/env ruby
require 'xcodeproj'

project_path = File.join(__dir__, '..', 'ios', 'Runner.xcodeproj')
project = Xcodeproj::Project.open(project_path)

ext_target = project.targets.find { |t| t.name == 'SwiftSafariExtension' }
runner_target = project.targets.find { |t| t.name == 'Runner' }

raise "Extension target not found" unless ext_target
raise "Runner target not found" unless runner_target

# Fix Extension build settings to match working Scrolly project
ext_target.build_configurations.each do |config|
  s = config.build_settings
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['DEVELOPMENT_TEAM'] = 'QN975MTM7H'
  s['GENERATE_INFOPLIST_FILE'] = 'YES'
  s['INFOPLIST_FILE'] = 'SwiftSafariExtension/Info.plist'
  s['INFOPLIST_KEY_CFBundleDisplayName'] = 'Swift Gestures'
  s['INFOPLIST_KEY_NSHumanReadableCopyright'] = ''
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.shadowengine.app.extension'
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['SWIFT_VERSION'] = '5.0'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['CURRENT_PROJECT_VERSION'] = '1'
  s['MARKETING_VERSION'] = '1.0.0'
  s['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
  s['SDKROOT'] = 'iphoneos'
  s['CLANG_ENABLE_OBJC_WEAK'] = 'YES'
  # Remove problematic settings
  s.delete('VALIDATE_PRODUCT') if config.name == 'Debug'
end

# Ensure "Embed Foundation Extensions" copy files build phase exists
embed_phase = runner_target.build_phases.find { |p|
  p.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) &&
  p.name&.include?('Embed') && p.name&.include?('Extension')
}

unless embed_phase
  embed_phase = runner_target.new_copy_files_build_phase('Embed Foundation Extensions')
  embed_phase.dst_subfolder_spec = '13' # PlugIns folder
  embed_phase.dst_path = ''

  build_file = embed_phase.add_file_reference(ext_target.product_reference)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

  # Move embed phase before Thin Binary
  phases = runner_target.build_phases.to_a
  thin_idx = phases.index { |p| p.respond_to?(:name) && p.name == 'Thin Binary' }
  embed_idx = phases.index(embed_phase)
  if thin_idx && embed_idx && embed_idx > thin_idx
    phases.delete(embed_phase)
    phases.insert(thin_idx, embed_phase)
    runner_target.build_phases.clear
    phases.each { |p| runner_target.build_phases << p }
  end

  puts "Added 'Embed Foundation Extensions' build phase"
else
  puts "Embed Foundation Extensions phase already exists"
end

# Ensure dependency on SwiftSafariExtension
unless runner_target.dependencies.any? { |d| d.target == ext_target }
  runner_target.add_dependency(ext_target)
  puts "Added dependency: Runner -> SwiftSafariExtension"
else
  puts "Dependency already exists"
end

project.save
puts "Extension signing fixed."
puts "Build configurations updated: #{ext_target.build_configurations.map(&:name).join(', ')}"
